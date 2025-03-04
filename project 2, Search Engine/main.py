from bs4 import BeautifulSoup
from elasticsearch import Elasticsearch
import json
import os
import re


def normalize_persian(text):
    """
    Comprehensive Persian text normalization
    """
    # تبدیل کاراکترهای عربی به فارسی
    replacements = {
        'ي': 'ی',
        'ك': 'ک',
        '‌': ' ',  # نیم‌فاصله به فاصله
        'ؤ': 'و',
        'ة': 'ه',
        'إ': 'ا',
        'أ': 'ا',
        'آ': 'ا',
        '۰': '0',
        '۱': '1',
        '۲': '2',
        '۳': '3',
        '۴': '4',
        '۵': '5',
        '۶': '6',
        '۷': '7',
        '۸': '8',
        '۹': '9'
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    # حذف تشدید و اعراب
    text = re.sub(r'[\u064B-\u065F\u0670]', '', text)

    return text


def clean_text(text):
    """
    پاکسازی متن از کاراکترهای اضافی و فرمت‌کردن فاصله‌ها
    """
    # حذف کاراکترهای خاص
    text = re.sub(r'[،؛.,;*\-+()\[\]{}«»""]/g', ' ', text)

    # حذف فاصله‌های تکراری
    text = re.sub(r'\s+', ' ', text)

    # حذف فاصله‌های ابتدا و انتها
    text = text.strip()

    return text


def extract_data(html_file):
    """
    استخراج و نرمال‌سازی داده از فایل HTML
    """
    with open(html_file, 'r', encoding='utf-8') as h:
        soup = BeautifulSoup(h, 'html.parser')

        # استخراج عنوان
        title = soup.find("title")
        title = title.get_text() if title else ""

        # حذف تگ‌های اسکریپت و استایل
        for tag in soup(['script', 'style', 'header', 'footer', 'nav']):
            tag.decompose()

        # استخراج متن و نرمال‌سازی
        text = soup.get_text()
        normalized_text = normalize_persian(clean_text(text))

        return title, normalized_text


def put_doc(index, url, title, content):
    """
    ذخیره‌سازی داده در Elasticsearch
    """
    try:
        es.index(index="persian_engine",
                 id=index,
                 document={
                     "title": normalize_persian(title),  # نرمال‌سازی عنوان
                     "body": content,
                     "url": url
                 })
    except Exception as e:
        print(f"Error indexing document {index}: {str(e)}")


# تنظیمات Elasticsearch
es = Elasticsearch(
    "http://localhost:9200/",
    api_key="STVJcXJaTUJzalRFcUxmRFpyemg6SGFQano4d1VRaUNxbHVIQ1pfQVNSQQ=="
)

# خواندن فایل نتایج
with open("crawl_results.json", "r") as f:
    documents = json.loads(f.read())["visited_urls"]

path = r"C:\pycharm projects\University\Web Crawler"
count = 1

# پردازش اسناد
for link, doc_name in documents.items():
    try:
        doc = extract_data(os.path.join(path, doc_name["path"]))
        put_doc(count, link, doc[0], doc[1])
        count += 1
    except Exception as e:
        print(f"Error processing {link}: {str(e)}")