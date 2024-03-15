def generate_message(client, ceo_name, email, company_name, company_description = ""):
    # Construct the prompt
    prompt = (f"""CEO's Name: {ceo_name} 
        CEO's Company name: {company_name} 
        This is information about the CEO's company: {company_description}
        Email Template:

        Dear [CEO's Name],

        I'm a lead developer from StarGlow Ventures, and I was highly impressed by [specific detail about the CEO's company]. 

        We're eager to utilize our expertise in your ongoing or upcoming project.

        <b>Our team, comprising 11 skilled professionals, specializes in websites and web applications, mobile apps, blockchain, and AI development. 

        We have a track record of accelerating project timelines by 20%, delivering innovative solutions tailored for clients similar to [CEO's company name]. </b>

        Whether we take on the development of the entire project independently, align with specific tasks assigned by you, or integrate seamlessly into your team, StarGlow Ventures is fully adaptable to meet your strategic objectives and goals.

        Looking forward to exploring how our collaboration can bring outstanding results to your projects.

        Warm regards,

        James Kai
        Lead Developer
        StarGlow Ventures
        +1 (604) 243-7330,  +1 (778) 650-9556, +1 (604) 998-8820
        Write an email using this template.
        0. Complete CEO's company name, CEO's name, and detail about CEO's company
        1. The template I provided is example message. Make impactful message by ADDING MORE achievements(creatively imagine!!!) not just only the example
        2. Make content in HTML format.
        3. Provide me exact JSON format {{"subject": "...", "content": "..."}}
        4. Don't write https://starglowventures.com directly. Instead write <a> link with href="https://starglowventures.com?id={
            email
        }" for example '..., <a href="...">visit our website</a>'. Make link only for starglow ventures.
        5. Remove <html><body>, </body></html>.
        6. Add unsubscribe section with link of href="https://starglowventures.com/unsubscribe?id={
            email
        }" in the footer.
        7. Never include 'opportunity' or 'opportunities' in the subject.
        8. Add this in the bottom of email. <img src="https://starglowventures.com/email/track_image.png?id={email}" />
    """)

    # Create a chat completion
    chat_completion = client.chat.completions.create(
        messages=[
            {"role": "user", "content": prompt}
        ],
        model="gpt-3.5-turbo",
    )

    # Extract and print the assistant's response
    response_message = chat_completion.choices[0].message
    return response_message.content