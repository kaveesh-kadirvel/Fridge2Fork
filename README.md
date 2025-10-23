# 🥦 Fridge2Fork – Your Smart Recipe Finder 🍳

Fridge2Fork is a **Flask-based web application** that helps users discover recipes based on the ingredients they already have in their fridge. It aims to reduce food waste and make cooking smarter, simpler, and more efficient.

---

## 💡 About the Project

Ever opened your fridge and thought, *"What can I cook with just these ingredients?"*  
Fridge2Fork solves that problem!  
Users can input the ingredients they have, and the app suggests recipes that can be prepared using them — helping save time, reduce waste, and inspire creativity in the kitchen.

---

## 🛠️ Tech Stack

**Frontend:**
- HTML  
- CSS  
- JavaScript  

**Backend:**
- Python (Flask Framework)

**Database:**
- CSV-based recipe dataset

**Other Tools:**
- Jinja2 (for templating)  
- Pandas (for data handling)  

---

## ⚙️ Features

✅ Ingredient-based recipe search  
✅ Dynamic recipe suggestions  
✅ Clean and responsive UI  
✅ Lightweight and easy to run locally  

---

## 📚 What We Learned

- Building a full-stack web app using Flask  
- Handling backend routing, data filtering, and template rendering  
- Integrating and processing datasets  
- Team collaboration and version control  

---

## 💻 Installation & Setup

Follow these steps to run Fridge2Fork locally 👇  

### 1. Clone the Repository
```bash

2. Create a Virtual Environment
python -m venv venv
venv\Scripts\activate      # For Windows
# or
source venv/bin/activate   # For macOS/Linux

3. Install Dependencies
pip install -r requirements.txt

4. Run the Application
python app.py

5. Open in Browser

Visit 👉 http://127.0.0.1:5000/

📂 Project Structure
Fridge2Fork/
│
├── static/                 # CSS, JS, Images
├── templates/              # HTML templates (Jinja2)
├── data/                   # Recipe dataset (CSV)
├── app.py                  # Main Flask application
├── requirements.txt        # Dependencies
└── README.md               # Project Documentation

🚀 Future Enhancements

Deploy the project using Render or Vercel

Add user login & recipe saving feature

Integrate APIs for more diverse recipe data

Enable image display for each recipe

🧠 Inspiration

The idea behind Fridge2Fork came from a common student struggle — limited ingredients and no idea what to cook!
This project turned that simple problem into an opportunity to learn Flask, data processing, and teamwork.

📸 Screenshots (Optional)

Add screenshots or demo images here once available.

📜 License

This project is created for educational purposes as part of a Semester 3 Mini Project.
You’re free to use or modify it with proper credit.
git clone https://github.com/your-username/fridge2fork.git
cd fridge2fork
