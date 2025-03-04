import asyncio
import aiohttp
import time
import os
import json
import re
import requests
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup


class AsyncCrawler:
    def __init__(self, start_url, max_urls=4000, timeout=30, max_tasks=40, max_retries=2):
        self.start_url = start_url
        self.max_urls = max_urls
        self.timeout = timeout
        self.max_tasks = max_tasks
        self.max_retries = max_retries  # حداکثر تعداد تلاش مجدد برای هر URL

        # متغیرهای ذخیره لینک‌ها و نتایج
        self.found_urls = {}
        self.visited_urls = {}
        self.error_urls = {}
        self.queue = asyncio.Queue()
        self.session = None
        self.disallow_rules = []
        self.file_counter = 1  # شمارنده برای ترتیب نام فایل‌های HTML

    async def fetch(self, url, retry_count=0):
        """گرفتن محتوای یک URL به صورت async با مدیریت تعداد تلاش‌ها."""
        try:
            async with self.session.get(url, timeout=self.timeout) as response:
                if 'text/html' in response.headers.get('Content-Type', ''):
                    if response.status == 200:
                        html_content = await response.text()
                        print(f"Fetched: {url}")
                        return html_content, url, response.status
                    else:
                        print(f"Error fetching {url} -> Status {response.status}")
                        return None, url, response.status
                else:
                    print(f"Skipped non-HTML content: {url}")
                    return None, url, 'Non-HTML content'
        except asyncio.TimeoutError:
            print(f"Timeout for: {url}")
            return None, url, 'Timeout'
        except ConnectionResetError:
            print(f"Max retries reached for {url}. Skipping.")
            return None, url, 'ConnectionResetError'
        except (aiohttp.ClientError, OSError) as e:
            print(f"Skipping error for {url}: {e}")
            return None, url, 'Connection Error'
        except Exception as e:
            print(f"Error fetching: {url} -> {e}")
            return None, url, str(e)

    def parse_links(self, html, base_url):
        """استخراج لینک‌ها از محتوای HTML با استفاده از BeautifulSoup."""
        soup = BeautifulSoup(html, 'html.parser')
        found_links = set()
        file_extensions = re.compile(
            r".*\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|zip|rar|mp4|webm|mp3|avi|mkv)(\?.*)?$", re.IGNORECASE)

        for tag in soup.find_all('a', href=True):
            link = urljoin(base_url, tag['href'])

            # بررسی اکستنشن فایل‌ها؛ اگر لینک فایل است به found_urls اضافه شود و وارد صف نشود
            if file_extensions.match(link):
                self.found_urls[link] = self.found_urls.get(link, 0) + 1
                continue

            if not self.is_url_allowed(link):
                self.found_urls[link] = self.found_urls.get(link, 0) + 1
                continue

            found_links.add(link)

        return found_links

    def is_url_allowed(self, url):
        """چک کردن مجاز بودن URL با استفاده از قوانین robots.txt."""
        parsed_url = urlparse(url)
        allow_domain = "fa.wikipedia.org"

        if parsed_url.hostname is not None:
            if not parsed_url.hostname.startswith("fa."):
                return False
        else:
            print(url)
            return False

        for rule in self.disallow_rules:
            if rule in parsed_url.path:
                return False
        return True

    def check_uniqueness(self, url):
        """بررسی یکتا بودن URL و اینکه قبلا fetch نشده باشد."""
        return url not in self.found_urls

    async def worker(self):
        """Worker برای پردازش URL‌ها از صف."""
        while True:
            url = await self.queue.get()

            if len(self.visited_urls) >= self.max_urls:
                self.queue.task_done()
                break

            # Fetch و پردازش URL
            html, url, status = await self.fetch(url)

            if html:
                path = self.save_html_to_file(url, html)

                # استخراج لینک‌ها و افزودن لینک‌های جدید به صف
                found_links = self.parse_links(html, url)
                for link in found_links:
                    if self.check_uniqueness(link):
                        await self.queue.put(link)

                    self.found_urls[link] = self.found_urls.get(link, 0) + 1

                # ذخیره اطلاعات لینک‌های بازدیدشده
                self.visited_urls[url] = {'path': path, 'status': status}
            else:
                self.error_urls[url] = status

            self.queue.task_done()

    async def crawl(self):
        """تابع اصلی برای خزش لینک‌ها."""
        async with aiohttp.ClientSession() as session:
            self.session = session
            await self.queue.put(self.start_url)
            start_time = time.time()

            # ایجاد کارگرها
            tasks = [asyncio.create_task(self.worker()) for _ in range(self.max_tasks)]

            # کنترل تعداد لینک‌های بازدید شده به جای استفاده از queue.join
            while len(self.visited_urls) < self.max_urls:
                await asyncio.sleep(1)

            # محاسبه تعداد باقی‌مانده در صف
            len_queue = self.queue.qsize()

            # توقف کارگرها
            for task in tasks:
                task.cancel()

            end_time = time.time()
            crawl_time = end_time - start_time

            # ذخیره نتایج خزش
            self.save_results(crawl_time, len_queue)

    def save_html_to_file(self, url, html):
        """ذخیره محتوای HTML به فایل با نام مرتب‌شده."""
        parsed_url = urlparse(url)
        filename = os.path.join("downloaded_pages", f"{self.file_counter}.html")
        self.file_counter += 1
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, 'w', encoding='utf-8') as file:
            file.write(html)
        return filename

    def save_results(self, crawl_time, len_queue):
        """ذخیره نتایج نهایی خزش در فایل JSON."""
        result = {
            'crawl_time': crawl_time,
            'total_visited': len(self.visited_urls),
            'total_found_with_duplicate': self.calculate_found_urls(),
            'total_found_without_duplicate': len(self.found_urls),
            'len_queue': len_queue,
            'visited_urls': self.visited_urls,
            'error_urls': self.error_urls,
            'found_urls': self.found_urls
        }
        with open('crawl_results.json', 'w') as f:
            json.dump(result, f, indent=4)
        print(f"Results saved to crawl_results.json")

    def calculate_found_urls(self):
        count = 0
        for i in self.found_urls.values():
            count += i

        return count

    def fetch_robots_txt(self, url):
        """دانلود و پردازش robots.txt با استفاده از requests."""
        robots_url = urljoin(url, "/robots.txt")
        try:
            response = requests.get(robots_url, timeout=self.timeout)
            if response.status_code == 200:
                robots_txt = response.text
                print(f"Downloaded robots.txt from {robots_url}")
                return self.parse_robots_txt(robots_txt)
        except Exception as e:
            print(f"Error fetching robots.txt: {e}")
        return []

    def parse_robots_txt(self, robots_txt):
        """تجزیه محتوای robots.txt و ذخیره قوانین Disallow برای User-agent:*"""
        user_agent = None
        for line in robots_txt.splitlines():
            line = line.strip()
            if line.startswith('User-agent:'):
                user_agent = line.split(':')[1].strip()
            elif line.startswith('Disallow:') and (user_agent == '*' or user_agent == 'YourCrawlerName'):
                rule = line.split(':')[1].strip()
                self.disallow_rules.append(rule)


async def main():
    start_url = "https://fa.wikipedia.org/"
    crawler = AsyncCrawler(start_url, max_urls=4000)
    crawler.fetch_robots_txt(start_url)  # دانلود robots.txt
    await crawler.crawl()  # شروع فرآیند خزش


if __name__ == "__main__":
    asyncio.run(main())
