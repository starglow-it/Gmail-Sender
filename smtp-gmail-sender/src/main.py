from pymongo import MongoClient
from openai import OpenAI
from dotenv import load_dotenv

import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import json
import time

from gpt_generate_message import generate_message
from scrape_website import fetch_website_data

# Load environment variables from .env file
load_dotenv()

# OpenAI Client
openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# MongoDB connection
mongo_client = MongoClient(os.getenv('MONGO_DB_URI'))
db = mongo_client['reachStream']

# Email settings
smtp_server = os.getenv('SMTP_SERVER')  
smtp_port = os.getenv('SMTP_PORT')  
smtp_user = os.getenv('SMTP_USER')
smtp_password = os.getenv('SMTP_PASSWORD')

def send_email(server, to_email, subject, message):
    # Setup the MIME
    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(message, 'html'))

    #Send the email
    try:
        text = msg.as_string()
        server.sendmail(smtp_user, to_email, text)
        print(f"Email sent to {to_email}")

        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

        return False


def fetch_and_parse_gpt_response(openai_client, contact, company_description):
    max_retries = 5
    retry_delay = 2  # seconds
    for attempt in range(max_retries):
        try:
            # Assuming generate_message is your function that calls the GPT API
            gpt_response = generate_message(openai_client, contact['contact_name'], contact['contact_email_1'], contact['company_company_name'], company_description)
            # Parse JSON into dictionary
            parsed_response = json.loads(gpt_response)

            return parsed_response  # Successfully parsed, return the response
        except Exception as e:
            print(f"JSON decode error on attempt {attempt+1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)  # Wait for a bit before retrying
            else:
                print("Max retries reached. Moving to the next contact.")
                # Handle the failure case, e.g., log error, skip to next contact, etc.
                return None
    

def main():
    # Get collection name, start index and end index from the user input
    collection_name = input('Enter the collection name: ')
    start_index = int(input('Enter the start index: '))
    end_index = int(input('Enter the end index: '))

    contacts_collection = db[collection_name]  # Here, replace the collection name you want to send email to.

    # SMTP Server configuration
    server = smtplib.SMTP(smtp_server, smtp_port)
    server.starttls()   # Enable security
    server.login(smtp_user, smtp_password)   # Login with credential

    # Retrieving data from the database.
    contacts = list(contacts_collection.find())[start_index:end_index]

    for contact in contacts:
        # Scrape company description from their website
        company_description = fetch_website_data(contact['company_website'])


        # Retrieve response dictionary after fetching GPT API and parsing.
        parsed_dict = fetch_and_parse_gpt_response(openai_client, contact, company_description)

        # If still error in GPT response and exceed the maximum count, move to the next content
        if (parsed_dict == None):
            pass

        # Send email and retrieve sent_status
        is_sent_successfully = send_email(server, contact['contact_email_1'], parsed_dict['subject'], parsed_dict['content'])

        #Update the database if the email was sent successfully
        if is_sent_successfully:
            contacts_collection.update_one(
                {"_id": contact["_id"]},
                {"$set": {"sent_status": True}},
                upsert=True
            )

    server.quit()

if __name__ == "__main__":
    main()