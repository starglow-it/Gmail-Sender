from pymongo import MongoClient
from dotenv import load_dotenv

import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import json
import time
from itertools import cycle, islice
import socket

from gpt_generate_message import generate_message
from scrape_website import fetch_website_data

# Load environment variables from .env file
load_dotenv()

# MongoDB connection
mongo_client = MongoClient(os.getenv('MONGO_DB_URI'))
db = mongo_client['github-contacts']

# Email settings
smtp_server = os.getenv('SMTP_SERVER')  
smtp_port = os.getenv('SMTP_PORT') 

def load_smtp_credentials():
    credential_list = [
        {
            'smtp_user': os.getenv(f'SMTP_USER_{i}'),
            'smtp_password': os.getenv(f'SMTP_PASSWORD_{i}'),
            'user_name': os.getenv(f'SMTP_USERNAME_{i}'),
            'phone': os.getenv(f'SMTP_PHONE_{i}'),
            'telegram': os.getenv(f'SMTP_TELEGRAM_{i}'),
            'skype': os.getenv(f'SMTP_SKYPE_{i}'),
            'discord': os.getenv(f'SMTP_DISCORD_{i}')
        }
        for i in range(1, 24)
        if os.getenv(f'SMTP_USER_{i}') and os.getenv(f'SMTP_PASSWORD_{i}') and os.getenv(f'SMTP_USERNAME_{i}')
    ]
    return credential_list


def send_email(server, from_email, to_email, subject, message):
    print('From: ', from_email, '       To: ', to_email)

    # Setup the MIME
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(message, 'plain'))

    #Send the email
    try:
        text = msg.as_string()
        server.sendmail(from_email, to_email, text)
        print("Email has been sent successfully.")

        return True
    except smtplib.SMTPConnectError as e:
        print(f"Connection Error, {e}")

        return False
    except smtplib.SMTPSenderRefused as e:
        print('SMTPSenderRefused', {e})
        return False
    except smtplib.SMTPResponseException as e:
        if ('Daily user sending limit exceeded' in str(e.smtp_error)) :
            print('Daily sending limit exceeded. Removing this email address from today\'s sending email list.')

        return 'limit_exceeded'
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

        return False


def main():
    # Get collection name, start index and end index from the user input
    # collection_name = input('Enter the collection name: ')
    start_index = int(input('Enter the start index: '))
    end_index = int(input('Enter the end index: '))
    time_interval = int(input('Enter the time interval in seconds: '))

    credential_list = load_smtp_credentials()

    contacts_collection = db['users']  # Here, replace the collection name you want to send email to.


    # Cycle through credentials indefinitely
    credential_cycle = cycle(credential_list)

    # Retrieving only filtered data from the database and sort by id.
    contacts = list(contacts_collection.find({'sent_status': None}).sort({'_id': 1}))[start_index:end_index]

    for index, contact in enumerate(contacts):
        # Check if the credential list is empty
        if not credential_list:
            print('Credential list is empty. Exiting here...')
            break

        print('Sending Email No.', start_index + index, '...')

        cred = next(credential_cycle)
            
        subject = "Connecting with Fellow Developer on GitHub"
        content = f"""
Hi {contact['fullName']}!
I hope this message finds you well. My name is {cred['user_name']}, and I'm a fellow developer based in Conroe, Texas. I came across your GitHub profile and was genuinely impressed by your work{' on ' + contact['mostStarredRepo']['name'] + ' repository' if contact['mostStarredRepo']['stars'] > 30 else ''}.

You can check out my GitHub profile here: https://github.com/starglow-it

Currently, I am working on a project related to a video chatting website called Chatruume, built using the MERN Stack and Livekit. Feel free to take a look: https://chatruume.com/ .

I believe we share some common interests, particularly in software development. I would love the opportunity to connect and learn more about your experiences and insights.

If you're open to it, I'd be thrilled to chat over email, Skype, Telegram, WhatsApp, Discord, or a quick video call. I believe we could have a valuable exchange of ideas and perhaps even collaborate on future projects.

Looking forward to hearing from you.

Best regards,

{cred['user_name']}

{'Phone: ' + cred['phone'] if cred['phone'] else ""}
{'Telegram: ' + cred['telegram'] if cred['telegram'] else ""}
{'Skype: ' + cred['skype'] if cred['skype'] else ""}
{'Discord: ' + cred['discord'] if cred['discord'] else ""}

                    """
        
        try:    
            # SMTP Server configuration
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()   # Enable security
            server.login(cred['smtp_user'], cred['smtp_password'])   # Login with credential
            # Send email and retrieve sent_status
            send_email_result = send_email(server, cred['smtp_user'], contact['email'], subject, content)

            #Update the database if the email was sent successfully
            if send_email_result == True:
                contacts_collection.update_one(
                    {"_id": contact["_id"]},
                    {"$set": {"sent_status": True, "sent_email": cred['smtp_user']}},
                    upsert=True
                )
            elif send_email_result == 'limit_exceeded':
                # Remove the current credential from the cycle
                credential_list.remove(cred)
                credential_cycle = cycle(credential_list)

            server.quit()
        except smtplib.SMTPAuthenticationError as e: # 
            print(f"Authentication failed. Removing this credential from the sending email list.")
            # Remove the current credential from the cycle
            credential_list.remove(cred)
            credential_cycle = cycle(credential_list)
        except socket.error:
            print('Your PC may be offline. Exiting here...')
            break
        except Exception as e:
            print(f"Error occurred in sending email, {e}")
        
        time.sleep(time_interval)

if __name__ == "__main__":
    main()