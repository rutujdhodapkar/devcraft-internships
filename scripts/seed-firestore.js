import { readFileSync, existsSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH && existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH)) {
  serviceAccount = JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH, "utf8"));
} else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID || "login-data-680b9",
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
} else {
  console.error("Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_SERVICE_ACCOUNT_KEY_PATH, or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.");
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore(app, "intern");

const t = (title, desc, links) => ({ title, description: desc, type: "text", links, quizQuestions: [], passingGrade: 100 });
const q = (title, desc, links, questions) => ({ title, description: desc, type: "quiz", links, passingGrade: 40, quizQuestions: questions });

const CAREER_PATHS = [
  {
    id: "path_web", title: "Web Development", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Build responsive websites and web applications using HTML, CSS, JavaScript, and React.",
    features: ["HTML5 & CSS3 layouts", "JavaScript fundamentals", "React components & hooks", "Responsive design"],
    projects: [
      {
        title: "Web Development Fundamentals Quiz",
        description: "Test your understanding of web development basics including HTML, CSS, and JavaScript.",
        type: "quiz", links: [
          "https://developer.mozilla.org/en-US/docs/Learn",
          "https://www.freecodecamp.org/learn/responsive-web-design/",
          "https://css-tricks.com/guides/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which HTML tag is used to link an external CSS file?", type: "option", options: ["<style>", "<link>", "<script>", "<meta>"], answer: "<link>" },
          { question: "Which CSS property makes a flex container?", type: "option", options: ["display: block", "display: flex", "position: relative", "float: left"], answer: "display: flex" },
          { question: "Which JavaScript keyword declares a block-scoped variable?", type: "option", options: ["var", "let", "int", "string"], answer: "let" },
          { question: "What does the DOM stand for?", type: "option", options: ["Document Object Model", "Data Object Model", "Document Oriented Model", "Display Object Management"], answer: "Document Object Model" },
          { question: "Which method adds an element at the end of an array?", type: "option", options: ["push()", "pop()", "shift()", "unshift()"], answer: "push()" },
          { question: "What is the correct way to create a React functional component?", type: "option", options: ["function App() {}", "class App extends {}", "createComponent App", "Component('App', {})"], answer: "function App() {}" },
          { question: "Which HTML attribute is used for JavaScript click handlers?", type: "option", options: ["onclick", "onpress", "ontap", "onhover"], answer: "onclick" },
          { question: "What does API stand for?", type: "option", options: ["Application Programming Interface", "Application Processing Interface", "Automated Program Integration", "Advanced Programming Interface"], answer: "Application Programming Interface" },
          { question: "Which CSS unit is relative to the viewport width?", type: "option", options: ["px", "em", "rem", "vw"], answer: "vw" },
          { question: "What is the purpose of git?", type: "option", options: ["Version control", "Database management", "CSS framework", "Build tool"], answer: "Version control" },
        ],
      },
      t("Responsive Portfolio Website", "Design and code a multi-page personal portfolio website from scratch. Include a hero section, about me, projects gallery, skills showcase, and contact form. Ensure the layout is fully responsive across mobile, tablet, and desktop using CSS media queries and flexbox/grid.", ["https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web", "https://www.freecodecamp.org/news/responsive-design-best-practices/", "https://github.com/topics/portfolio-website"]),
      t("E-commerce Product Page", "Build a product listing page for an online store with a clean grid layout. Include category filters, a sort dropdown, product cards with images/prices, and a working shopping cart that updates quantities and totals using JavaScript.", ["https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout", "https://www.freecodecamp.org/news/javascript-shopping-cart-tutorial/"]),
      t("JavaScript Calculator", "Develop a fully functional calculator web app supporting addition, subtraction, multiplication, and division. Include a clean UI with buttons for digits 0-9, operators, clear/reset, and an LCD-style display. Handle edge cases like division by zero.", ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators", "https://www.freecodecamp.org/news/how-to-build-a-calculator-in-javascript/"]),
      t("Landing Page Clone", "Pick a professional landing page design (SaaS product, app, or service) and recreate it pixel-perfect from a screenshot using HTML, CSS, and vanilla JavaScript. Focus on typography, spacing, animations, and responsive behavior.", ["https://css-tricks.com/guides/", "https://www.freecodecamp.org/news/how-to-build-a-landing-page-with-html-css-and-javascript/", "https://dribbble.com/search/landing-page"]),
      t("API Dashboard", "Connect to a public REST API (e.g., weather, crypto, or news) and build an interactive dashboard. Display fetched data using Chart.js or vanilla JS charts. Include search/filter controls and auto-refresh functionality.", ["https://github.com/public-apis/public-apis", "https://www.chartjs.org/docs/latest/", "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API"]),
    ],
  },
  {
    id: "path_python", title: "Python Development", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Master Python programming for scripting, automation, and backend development.",
    features: ["Python syntax & data types", "OOP concepts", "File handling & modules", "APIs & libraries"],
    projects: [
      {
        title: "Python Fundamentals Quiz",
        description: "Test your knowledge of Python syntax, data structures, and OOP concepts.",
        type: "quiz", links: [
          "https://docs.python.org/3/tutorial/",
          "https://realpython.com/",
          "https://www.w3schools.com/python/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "How do you print output in Python 3?", type: "option", options: ["echo()", "print()", "console.log()", "System.out.println()"], answer: "print()" },
          { question: "Which data type is immutable in Python?", type: "option", options: ["List", "Dictionary", "Tuple", "Set"], answer: "Tuple" },
          { question: "What keyword defines a function in Python?", type: "option", options: ["func", "define", "function", "def"], answer: "def" },
          { question: "How do you handle exceptions in Python?", type: "option", options: ["try-except", "try-catch", "catch-throw", "error-handle"], answer: "try-except" },
          { question: "Which library is used for numerical computing in Python?", type: "option", options: ["NumPy", "Pandas", "Matplotlib", "Scikit-learn"], answer: "NumPy" },
          { question: "What does OOP stand for?", type: "option", options: ["Object-Oriented Programming", "Online Object Processing", "Output-Oriented Programming", "Object Operation Protocol"], answer: "Object-Oriented Programming" },
          { question: "Which keyword creates a class in Python?", type: "option", options: ["class", "struct", "object", "type"], answer: "class" },
          { question: "What is the correct file extension for Python files?", type: "option", options: [".pt", ".py", ".pn", ".pyt"], answer: ".py" },
          { question: "How do you import a module named 'math'?", type: "option", options: ["include math", "require math", "import math", "using math"], answer: "import math" },
          { question: "Which data structure stores key-value pairs?", type: "option", options: ["List", "Tuple", "Dictionary", "Set"], answer: "Dictionary" },
        ],
      },
      t("Weather CLI Application", "Create a Python command-line app that fetches real-time weather data from OpenWeatherMap API. Accept city name as input, display temperature, humidity, wind speed, and conditions. Use requests library and format output with color coding for different weather types.", ["https://openweathermap.org/api", "https://realpython.com/python-requests/", "https://docs.python.org/3/library/argparse.html"]),
      t("File Organizer Script", "Write a Python script that scans a given directory, reads all file extensions, and auto-organizes files into categorized subfolders (Images, Documents, Audio, Video, Archives, Code, Others). Use os and shutil modules with error handling for duplicate names.", ["https://docs.python.org/3/library/os.html", "https://realpython.com/working-with-files-in-python/", "https://docs.python.org/3/library/shutil.html"]),
      t("Web Scraper", "Build a web scraper using BeautifulSoup and requests that extracts structured data (headlines, prices, or product info) from a public website. Save the scraped data to a CSV file using the csv module. Respect robots.txt and implement polite scraping with delays.", ["https://www.crummy.com/software/BeautifulSoup/bs4/doc/", "https://realpython.com/beautiful-soup-web-scraper-python/", "https://docs.python.org/3/library/csv.html"]),
      t("Password Generator", "Create a Python password generator with a GUI (tkinter) or CLI mode. Let users customize length (8-64), include/exclude uppercase, lowercase, digits, and special characters. Add clipboard copy and password strength indicator.", ["https://docs.python.org/3/library/secrets.html", "https://docs.python.org/3/library/tkinter.html", "https://realpython.com/python-gui-tkinter/"]),
      t("CLI Task Manager", "Build a command-line task manager in Python with persistent JSON storage. Implement commands: add (with title, priority, due date), list (filter by status), complete, delete, and search. Use argparse for CLI argument parsing and datetime for deadlines.", ["https://docs.python.org/3/library/json.html", "https://docs.python.org/3/library/argparse.html", "https://realpython.com/python-json/"]),
    ],
  },
  {
    id: "path_java", title: "Java Development", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Learn Java programming with strong OOP foundations, data structures, and real-world applications.",
    features: ["Java syntax & OOP", "Collections framework", "Exception handling", "File I/O & streams"],
    projects: [
      {
        title: "Java Programming Quiz",
        description: "Test your understanding of Java syntax, OOP concepts, and core libraries.",
        type: "quiz", links: [
          "https://docs.oracle.com/javase/tutorial/",
          "https://www.geeksforgeeks.org/java/",
          "https://www.javatpoint.com/java-tutorial",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which keyword is used to inherit a class in Java?", type: "option", options: ["extends", "implements", "inherits", "super"], answer: "extends" },
          { question: "What is the entry point of a Java program?", type: "option", options: ["main()", "start()", "run()", "init()"], answer: "main()" },
          { question: "Which data type stores a single character?", type: "option", options: ["String", "char", "character", "text"], answer: "char" },
          { question: "What does JVM stand for?", type: "option", options: ["Java Virtual Machine", "Java Visual Module", "Java Variable Manager", "Java Version Model"], answer: "Java Virtual Machine" },
          { question: "Which collection stores unique elements only?", type: "option", options: ["List", "Set", "Map", "Queue"], answer: "Set" },
          { question: "What keyword prevents a class from being inherited?", type: "option", options: ["private", "static", "final", "abstract"], answer: "final" },
          { question: "How do you handle exceptions in Java?", type: "option", options: ["try-catch", "try-except", "error-handle", "catch-throw"], answer: "try-catch" },
          { question: "Which access modifier makes a member visible to all classes?", type: "option", options: ["private", "protected", "public", "default"], answer: "public" },
          { question: "What is the superclass of all Java classes?", type: "option", options: ["Object", "Class", "Base", "Root"], answer: "Object" },
          { question: "Which method is called when an object is created?", type: "option", options: ["destructor", "constructor", "initializer", "builder"], answer: "constructor" },
        ],
      },
      t("Student Management System", "Build a console-based Java app to manage student records. Implement CRUD operations using ArrayList: add new students with roll number, name, and grades; display all students; search by roll number; update grades; and delete records. Use data validation and exception handling throughout.", ["https://docs.oracle.com/javase/tutorial/collections/", "https://www.geeksforgeeks.org/arraylist-in-java/", "https://docs.oracle.com/javase/tutorial/essential/exceptions/"]),
      t("Library Management System", "Create a Java library management application with book catalog management using HashMap. Implement features: add/remove books, search by title/author, borrow/return with due date tracking, and automatic fine calculation for late returns. Store data using file serialization.", ["https://docs.oracle.com/javase/tutorial/collections/", "https://www.geeksforgeeks.org/serialization-in-java/", "https://docs.oracle.com/javase/tutorial/java/IandI/polymorphism.html"]),
      t("Banking Application", "Build a banking system in Java with account types (Savings, Current) using inheritance. Include deposit/withdraw with balance validation, transaction history using LinkedList, interest calculation for savings accounts, and login authentication with password hashing.", ["https://docs.oracle.com/javase/tutorial/java/IandI/", "https://docs.oracle.com/javase/tutorial/essential/io/file.html", "https://www.baeldung.com/java-sha256"]),
      t("Employee Records System", "Develop an employee management system using file I/O in Java. Store employee data (ID, name, department, salary) in a serialized file. Implement features: add, display all, search by department, update salary, and delete with record keeping using HashMap and try-with-resources.", ["https://docs.oracle.com/javase/tutorial/essential/io/file.html", "https://www.geeksforgeeks.org/serialization-in-java/", "https://docs.oracle.com/javase/tutorial/essential/io/formatting.html"]),
      t("Online Quiz Platform", "Create a Java Swing-based quiz application that reads MCQ questions from a text file. Present one question at a time with radio button options, track answers, calculate score at the end, and display results with percentage. Use ActionListener for button events.", ["https://www.geeksforgeeks.org/java-swing-building-quiz-application/", "https://docs.oracle.com/javase/tutorial/uiswing/", "https://docs.oracle.com/javase/tutorial/essential/exceptions/"]),
    ],
  },
  {
    id: "path_cpp", title: "C / C++ Development", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Build a strong foundation in C and C++ with memory management, OOP, and STL.",
    features: ["Pointers & memory management", "OOP in C++", "STL containers & algorithms", "File handling"],
    projects: [
      {
        title: "C/C++ Programming Quiz",
        description: "Test your knowledge of C and C++ concepts including pointers, OOP, and STL.",
        type: "quiz", links: [
          "https://en.cppreference.com/w/",
          "https://www.programiz.com/cpp-programming",
          "https://www.geeksforgeeks.org/c-plus-plus/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which header is needed for input/output in C++?", type: "option", options: ["<stdio.h>", "<iostream>", "<stdlib.h>", "<string.h>"], answer: "<iostream>" },
          { question: "What operator is used to access a pointer's value?", type: "option", options: ["&", "*", "->", "."], answer: "*" },
          { question: "Which C++ feature allows functions with the same name but different parameters?", type: "option", options: ["Overriding", "Overloading", "Inheritance", "Polymorphism"], answer: "Overloading" },
          { question: "What keyword allocates memory in C++?", type: "option", options: ["malloc", "alloc", "new", "create"], answer: "new" },
          { question: "Which STL container stores elements in sorted order?", type: "option", options: ["vector", "list", "set", "map"], answer: "set" },
          { question: "What is a virtual function in C++?", type: "option", options: ["Function with default impl", "Function that can be overridden", "Static function", "Inline function"], answer: "Function that can be overridden" },
          { question: "Which access specifier makes members accessible only within the class?", type: "option", options: ["public", "protected", "private", "internal"], answer: "private" },
          { question: "What does sizeof() operator return?", type: "option", options: ["Size in bytes", "Size in bits", "Length of array", "Memory address"], answer: "Size in bytes" },
          { question: "Which of these is NOT a type of inheritance in C++?", type: "option", options: ["Single", "Multiple", "Hybrid", "Cascading"], answer: "Cascading" },
          { question: "What is the purpose of a destructor?", type: "option", options: ["Create object", "Copy object", "Clean up resources", "Access private members"], answer: "Clean up resources" },
        ],
      },
      t("Library Management System", "Develop a C++ library management system using OOP principles. Design classes Book, Member, and Transaction with appropriate inheritance. Store library data in binary files using fstream. Implement: add/remove books, register members, issue/return with date tracking, and fine calculation for overdue books.", ["https://en.cppreference.com/w/cpp/container", "https://www.geeksforgeeks.org/file-handling-c-classes/", "https://en.cppreference.com/w/cpp/chrono"]),
      t("Banking System", "Create a C++ banking application using inheritance (Account base, SavingsAccount and CurrentAccount derived). Implement virtual functions for deposit/withdraw logic. Store account data in a file, support transactions with date/time stamps, and calculate compound interest for savings accounts.", ["https://en.cppreference.com/w/cpp/language/virtual", "https://www.geeksforgeeks.org/inheritance-in-c/", "https://en.cppreference.com/w/cpp/chrono"]),
      t("Calendar Application", "Build a C++ calendar application using chrono library. Display a monthly calendar with proper day alignment, highlight current date, navigate between months with arrow key input, and allow users to add/view/delete events stored in a text file.", ["https://en.cppreference.com/w/cpp/chrono", "https://en.cppreference.com/w/cpp/io/manip", "https://www.programiz.com/cpp-programming/examples/display-current-date-time"]),
      t("Snake Game", "Implement the classic Snake game in C++ using console graphics. Use NCurses or Windows Console API for real-time keyboard input. Track score, increase speed as snake grows, detect collision with walls/self, and display game over screen with final score.", ["https://en.cppreference.com/w/cpp/io/c", "https://www.geeksforgeeks.org/snake-game-in-cpp/", "https://en.cppreference.com/w/cpp/thread"]),
      t("Sorting Visualizer", "Create a console-based sorting algorithm visualizer in C++. Implement bubble sort, selection sort, merge sort, and quick sort with step-by-step visualization using bars or numbers. Display comparisons and swaps count, and allow user to select array size and algorithm to watch.", ["https://en.cppreference.com/w/cpp/algorithm", "https://www.geeksforgeeks.org/sorting-algorithms-in-cpp/", "https://en.cppreference.com/w/cpp/thread/sleep_for"]),
    ],
  },
  {
    id: "path_data_science", title: "Data Science", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Extract insights from data using statistical analysis, machine learning, and Python tools.",
    features: ["Python for data analysis", "Statistical modeling", "Machine learning", "Data visualization"],
    projects: [
      {
        title: "Data Science Quiz",
        description: "Test your knowledge of data science concepts, statistics, and machine learning fundamentals.",
        type: "quiz", links: [
          "https://scikit-learn.org/stable/tutorial/index.html",
          "https://www.kaggle.com/learn",
          "https://towardsdatascience.com/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which Python library is primarily used for data manipulation?", type: "option", options: ["NumPy", "Pandas", "Matplotlib", "Scipy"], answer: "Pandas" },
          { question: "What does the term 'overfitting' mean?", type: "option", options: ["Model performs well on new data", "Model memorizes training data too well", "Model underperforms", "Model is too simple"], answer: "Model memorizes training data too well" },
          { question: "Which metric is used for classification problems?", type: "option", options: ["Mean Squared Error", "Accuracy", "R-squared", "RMSE"], answer: "Accuracy" },
          { question: "What is the purpose of train-test split?", type: "option", options: ["Speed up training", "Evaluate model on unseen data", "Reduce dataset size", "Visualize data"], answer: "Evaluate model on unseen data" },
          { question: "Which type of learning uses labeled data?", type: "option", options: ["Unsupervised", "Supervised", "Reinforcement", "Self-supervised"], answer: "Supervised" },
          { question: "What is the mean of the dataset [2, 4, 6, 8, 10]?", type: "option", options: ["4", "5", "6", "7"], answer: "6" },
          { question: "Which plot is best for showing data distribution?", type: "option", options: ["Bar chart", "Histogram", "Scatter plot", "Pie chart"], answer: "Histogram" },
          { question: "What does correlation measure?", type: "option", options: ["Causation between variables", "Relationship between variables", "Difference between groups", "Spread of data"], answer: "Relationship between variables" },
          { question: "Which algorithm is used for regression?", type: "option", options: ["K-Means", "Linear Regression", "Decision Tree Classifier", "KNN Classifier"], answer: "Linear Regression" },
          { question: "What is a confusion matrix used for?", type: "option", options: ["Data cleaning", "Evaluating classification models", "Feature selection", "Data transformation"], answer: "Evaluating classification models" },
        ],
      },
      t("Sales Prediction Model", "Build a regression model to predict store sales using historical transaction data from the Kaggle Store Sales dataset. Perform EDA with matplotlib/seaborn, engineer features (date, promotions, holidays), train a RandomForestRegressor, and evaluate using RMSE and R-squared. Save and deploy the model with joblib.", ["https://scikit-learn.org/stable/supervised_learning.html", "https://www.kaggle.com/learn/machine-learning", "https://www.kaggle.com/datasets/rohitsahoo/sales-forecasting"]),
      t("Customer Segmentation", "Apply K-Means clustering to segment online retail customers based on purchase history, frequency, and monetary value (RFM analysis). Use the Elbow method and silhouette score to find optimal clusters. Visualize segments with PCA and t-SNE, and profile each segment with descriptive stats.", ["https://scikit-learn.org/stable/modules/clustering.html", "https://www.kaggle.com/datasets/vjchoudhary7/customer-segmentation-tutorial-in-python", "https://archive.ics.uci.edu/ml/datasets/Online+Retail"]),
      t("Sentiment Analysis", "Perform sentiment analysis on a Twitter or product review dataset using NLP techniques. Clean and tokenize text with NLTK, extract features with TF-IDF, train a Naive Bayes classifier, and visualize sentiment distribution, word clouds, and confusion matrix. Achieve 85%+ accuracy.", ["https://www.nltk.org/", "https://scikit-learn.org/stable/modules/feature_extraction.html", "https://www.kaggle.com/datasets/kazanova/sentiment140"]),
      t("Recommendation System", "Build a collaborative filtering recommendation system using the MovieLens dataset. Implement user-user and item-item similarity approaches with cosine similarity. Add a popularity baseline and evaluate using RMSE. Optionally, use SVD from scikit-learn for matrix factorization.", ["https://scikit-learn.org/stable/modules/decomposition.html", "https://www.kaggle.com/learn/recommendation-systems", "https://grouplens.org/datasets/movielens/"]),
      t("Time Series Forecasting", "Analyze time series data (e.g., daily temperature, stock prices, or energy consumption) and build a forecasting model. Perform decomposition to identify trend/seasonality, test stationarity with ADF test, and train ARIMA/SARIMA or Facebook Prophet. Evaluate with MAE and visualize forecast vs actual.", ["https://facebook.github.io/prophet/", "https://www.kaggle.com/learn/time-series", "https://archive.ics.uci.edu/ml/datasets/Power+consumption+of+Tetouan+city"]),
    ],
  },
  {
    id: "path_data_analysis", title: "Data Analysis", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Analyze datasets, create dashboards, and derive actionable insights using SQL and visualization tools.",
    features: ["SQL queries & joins", "Excel & spreadsheets", "Data cleaning & transformation", "Dashboard creation"],
    projects: [
      {
        title: "Data Analysis Quiz",
        description: "Test your understanding of SQL, data cleaning, and data visualization techniques.",
        type: "quiz", links: [
          "https://sqlbolt.com/",
          "https://public.tableau.com/app/discover",
          "https://www.datacamp.com/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which SQL clause filters rows based on a condition?", type: "option", options: ["WHERE", "HAVING", "FILTER", "MATCH"], answer: "WHERE" },
          { question: "What does SQL stand for?", type: "option", options: ["Structured Query Language", "Simple Query Language", "Standard Query Logic", "Sequential Query Language"], answer: "Structured Query Language" },
          { question: "Which join returns only matching rows from both tables?", type: "option", options: ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL OUTER JOIN"], answer: "INNER JOIN" },
          { question: "What function counts the number of rows in a group?", type: "option", options: ["SUM()", "COUNT()", "AVG()", "TOTAL()"], answer: "COUNT()" },
          { question: "What is the process of handling missing data called?", type: "option", options: ["Data cleaning", "Data mining", "Data warehousing", "Data modeling"], answer: "Data cleaning" },
          { question: "Which Excel function finds the average of a range?", type: "option", options: ["SUM()", "AVG()", "AVERAGE()", "MEAN()"], answer: "AVERAGE()" },
          { question: "What type of chart is best for showing trends over time?", type: "option", options: ["Pie chart", "Bar chart", "Line chart", "Scatter plot"], answer: "Line chart" },
          { question: "Which SQL statement removes a table from the database?", type: "option", options: ["DELETE TABLE", "DROP TABLE", "REMOVE TABLE", "CLEAR TABLE"], answer: "DROP TABLE" },
          { question: "What does a pivot table do?", type: "option", options: ["Sorts data", "Summarizes and aggregates data", "Filters data", "Creates charts"], answer: "Summarizes and aggregates data" },
          { question: "Which data type stores date and time in SQL?", type: "option", options: ["DATE", "TIME", "DATETIME", "TIMESTAMP"], answer: "DATETIME" },
        ],
      },
      t("Sales Dashboard Project", "Analyze a sales dataset from Kaggle using SQL queries (aggregations, window functions, date filtering) and create an interactive Tableau/Power BI dashboard. Include KPIs: total revenue, top products, regional sales, monthly trends. Publish the dashboard and share the public link.", ["https://sqlbolt.com/lesson/select_queries_introduction", "https://public.tableau.com/en-us/gallery/", "https://www.kaggle.com/datasets/kyanyoga/sample-sales-data"]),
      t("Customer Analytics Report", "Perform RFM (Recency, Frequency, Monetary) analysis on an e-commerce customer dataset using Python. Clean and transform data with Pandas, assign quartile scores, segment customers into groups (Champions, Loyal, At Risk, Lost), and create a summary report with actionable recommendations.", ["https://www.kaggle.com/learn/data-cleaning", "https://www.tableau.com/learn/articles/rfm-analysis", "https://archive.ics.uci.edu/ml/datasets/Online+Retail"]),
      t("Web Analytics Analysis", "Analyze website traffic data using Google Analytics sample data. Write SQL queries to find top pages by traffic, user sessions by source/medium, conversion funnels, and bounce rates. Create a dashboard showing acquisition, behavior, and conversion metrics over time.", ["https://analytics.google.com/analytics/academy/", "https://www.kaggle.com/datasets/akashydv/google-analytics-sample", "https://console.cloud.google.com/marketplace/product/obfuscated-ga360-data/obfuscated-ga360-data"]),
      t("HR Analytics Project", "Analyze employee attrition data from the IBM HR Analytics dataset. Clean missing values, perform exploratory analysis with Pandas/Seaborn, identify key factors affecting retention (salary, tenure, department), build a logistic regression model to predict attrition, and present findings in a PowerPoint-style report.", ["https://www.kaggle.com/datasets/rhuebner/human-resources-data-set", "https://public.tableau.com/app/discover", "https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset"]),
      t("Supply Chain Analysis", "Analyze supply chain data to identify bottlenecks and optimize inventory levels using Python. Clean and merge datasets, calculate lead times and stock turnover rates, identify slow-moving vs fast-moving items, and create visual dashboards with recommendations for reorder points and safety stock levels.", ["https://www.kaggle.com/learn/data-visualization", "https://www.tableau.com/learn/articles/supply-chain-analytics", "https://www.kaggle.com/datasets/shashwatwork/dataco-supply-chain-giant"]),
    ],
  },
  {
    id: "path_ml", title: "Machine Learning", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Build and deploy machine learning models using supervised and unsupervised learning techniques.",
    features: ["Supervised learning", "Unsupervised learning", "Model evaluation", "Feature engineering"],
    projects: [
      {
        title: "Machine Learning Quiz",
        description: "Test your understanding of ML algorithms, evaluation metrics, and model building concepts.",
        type: "quiz", links: [
          "https://scikit-learn.org/stable/supervised_learning.html",
          "https://www.kaggle.com/learn/machine-learning",
          "http://cs229.stanford.edu/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which algorithm is used for classification?", type: "option", options: ["Linear Regression", "Logistic Regression", "K-Means", "PCA"], answer: "Logistic Regression" },
          { question: "What is the purpose of cross-validation?", type: "option", options: ["Clean data", "Evaluate model generalization", "Train faster", "Reduce features"], answer: "Evaluate model generalization" },
          { question: "Which metric is used for regression evaluation?", type: "option", options: ["Accuracy", "F1 Score", "Mean Squared Error", "Precision"], answer: "Mean Squared Error" },
          { question: "What does K-NN stand for?", type: "option", options: ["K-Nearest Nodes", "K-Nearest Neighbors", "Kernel Neural Network", "Knowledge Neural Net"], answer: "K-Nearest Neighbors" },
          { question: "Which type of learning groups unlabeled data?", type: "option", options: ["Supervised", "Unsupervised", "Reinforcement", "Semi-supervised"], answer: "Unsupervised" },
          { question: "What is the bias-variance tradeoff about?", type: "option", options: ["Balancing model complexity", "Choosing features", "Splitting data", "Selecting algorithms"], answer: "Balancing model complexity" },
          { question: "Which ensemble method combines multiple decision trees?", type: "option", options: ["SVM", "Random Forest", "K-Means", "Naive Bayes"], answer: "Random Forest" },
          { question: "What does PCA do?", type: "option", options: ["Predicts values", "Reduces dimensionality", "Clusters data", "Classifies data"], answer: "Reduces dimensionality" },
          { question: "What is gradient descent used for?", type: "option", options: ["Feature scaling", "Optimizing model parameters", "Data normalization", "Model evaluation"], answer: "Optimizing model parameters" },
          { question: "Which metric is best for imbalanced datasets?", type: "option", options: ["Accuracy", "F1 Score", "RMSE", "R-squared"], answer: "F1 Score" },
        ],
      },
      t("Spam Classifier Model", "Build and evaluate an ML model to classify SMS messages as spam or ham using the UCI SMS Spam Collection dataset. Preprocess text with TF-IDF vectorization, train multiple classifiers (Naive Bayes, SVM, Random Forest), compare F1 scores, and save the best model with joblib for deployment.", ["https://scikit-learn.org/stable/tutorial/text_analytics/working_with_text_data.html", "https://www.kaggle.com/datasets/uciml/sms-spam-collection-dataset", "https://archive.ics.uci.edu/ml/datasets/SMS+Spam+Collection"]),
      t("Image Classifier", "Train a CNN using TensorFlow/Keras on CIFAR-10 dataset. Build a model with Conv2D, MaxPooling, Dropout, and Dense layers. Apply data augmentation (rotation, flip, zoom), train for 50 epochs with early stopping, and evaluate with accuracy and confusion matrix. Save the model as .h5.", ["https://www.tensorflow.org/tutorials/images/cnn", "https://pytorch.org/tutorials/beginner/blitz/cifar10_tutorial.html", "https://www.cs.toronto.edu/~kriz/cifar.html"]),
      t("House Price Predictor", "Build a regression model to predict house prices using the Kaggle House Prices dataset. Perform feature engineering (handle missing values, encode categoricals, create interaction features), train RandomForest and XGBoost models, tune hyperparameters with GridSearchCV, and submit predictions on Kaggle.", ["https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestRegressor.html", "https://www.kaggle.com/learn/intermediate-machine-learning", "https://www.kaggle.com/c/house-prices-advanced-regression-techniques"]),
      t("Customer Churn Prediction", "Develop a classification model to predict telecom customer churn using the Telco dataset. Perform EDA with correlation heatmaps, handle class imbalance with SMOTE, train Logistic Regression and XGBoost, analyze feature importance with SHAP values, and deploy a Streamlit dashboard for predictions.", ["https://scikit-learn.org/stable/modules/feature_selection.html", "https://www.kaggle.com/datasets/blastchar/telco-customer-churn", "https://github.com/slundberg/shap"]),
      t("Model Deployment API", "Deploy a trained ML model as a REST API using FastAPI. Create endpoints for /predict (POST with JSON input) and /health (GET). Add input validation with Pydantic, model loading on startup, error handling, and API documentation with Swagger. Containerize with Docker.", ["https://fastapi.tiangolo.com/learn/", "https://flask.palletsprojects.com/en/stable/", "https://docs.docker.com/get-started/"]),
    ],
  },
  {
    id: "path_ai", title: "Artificial Intelligence", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Explore AI concepts including search algorithms, neural networks, NLP, and intelligent agents.",
    features: ["Search & optimization", "Neural networks", "Natural language processing", "Reinforcement learning"],
    projects: [
      {
        title: "AI Fundamentals Quiz",
        description: "Test your knowledge of AI concepts, neural networks, NLP, and intelligent systems.",
        type: "quiz", links: [
          "https://www.tensorflow.org/learn",
          "https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/6-034-artificial-intelligence-fall-2010/",
          "https://paperswithcode.com/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which algorithm is used for pathfinding in AI?", type: "option", options: ["A*", "K-Means", "Linear Regression", "PCA"], answer: "A*" },
          { question: "What is a neural network activation function?", type: "option", options: ["Sigmoid", "SQL", "JSON", "HTTP"], answer: "Sigmoid" },
          { question: "Which NLP task determines the sentiment of text?", type: "option", options: ["Translation", "Sentiment analysis", "Summarization", "Tokenization"], answer: "Sentiment analysis" },
          { question: "What is reinforcement learning based on?", type: "option", options: ["Labeled data", "Rewards and penalties", "Unlabeled data", "Rules"], answer: "Rewards and penalties" },
          { question: "Which network architecture is used for image recognition?", type: "option", options: ["RNN", "CNN", "GAN", "DBN"], answer: "CNN" },
          { question: "What is the Turing Test used for?", type: "option", options: ["Testing code quality", "Measuring machine intelligence", "Evaluating models", "Benchmarking hardware"], answer: "Measuring machine intelligence" },
          { question: "Which technique reduces overfitting in neural networks?", type: "option", options: ["Dropout", "Gradient descent", "Backpropagation", "Convolution"], answer: "Dropout" },
          { question: "What does NLP stand for?", type: "option", options: ["Natural Language Processing", "Neural Language Programming", "Network Layer Protocol", "Non-Linear Processing"], answer: "Natural Language Processing" },
          { question: "Which search algorithm uses a heuristic function?", type: "option", options: ["BFS", "DFS", "A*", "Binary Search"], answer: "A*" },
          { question: "What is the main goal of AI?", type: "option", options: ["Replace humans", "Create intelligent agents", "Build faster computers", "Write code"], answer: "Create intelligent agents" },
        ],
      },
      t("Chatbot Development", "Build a rule-based or ML-powered chatbot using Python and NLP libraries. Implement intent recognition with NLTK/spaCy, handle basic conversation flows with if-else or a simple neural classifier, add a web interface using Flask/Streamlit, and deploy on a free platform (Render or Hugging Face Spaces).", ["https://www.tensorflow.org/text", "https://www.nltk.org/", "https://huggingface.co/docs/transformers/task_summary"]),
      t("Game AI Agent", "Implement a Tic-Tac-Toe or Connect 4 AI agent using the Minimax algorithm with alpha-beta pruning. Create a playable console or Pygame interface, evaluate board states with a heuristic evaluation function, and test the agent against random and greedy opponents to measure win rates.", ["https://www.geeksforgeeks.org/minimax-algorithm-in-game-theory/", "https://en.wikipedia.org/wiki/Monte_Carlo_tree_search", "https://www.pygame.org/"]),
      t("Face Detection System", "Build a real-time face detection system using OpenCV's Haar Cascade or DNN module. Write a Python script that captures video from webcam, draws bounding boxes around detected faces, and saves snapshots on key press. Add gender/age prediction as a bonus using pre-trained models.", ["https://docs.opencv.org/4.x/d0/d86/tutorial_py_face_detection.html", "https://github.com/opencv/opencv/tree/master/samples/dnn", "https://github.com/serengil/deepface"]),
      t("Text Summarization Tool", "Create an extractive text summarization tool using NLP. Implement sentence scoring based on word frequency, sentence position, and keyword overlap. Use NLTK for tokenization and stopword removal. Accept any text input and return the top N sentences. Add a Streamlit UI for easy testing.", ["https://www.nltk.org/book/ch03.html", "https://www.tensorflow.org/text/tutorials/text_classification_rnn", "https://streamlit.io/"]),
      t("Question Answering System", "Build a closed-domain QA system that answers questions from a given PDF or text corpus. Use Hugging Face Transformers (BERT-based) for extractive QA, process documents into chunks, implement retrieval with sentence embeddings, and provide a Gradio or Streamlit interface for users to upload documents and ask questions.", ["https://huggingface.co/transformers/task_summary.html", "https://www.tensorflow.org/text/tutorials/bert_qa", "https://www.sbert.net/"]),
    ],
  },
  {
    id: "path_uiux", title: "UI/UX Design", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Design intuitive user interfaces and seamless user experiences using industry-standard tools.",
    features: ["Design principles & heuristics", "Wireframing & prototyping", "Visual design", "User research & testing"],
    projects: [
      {
        title: "UI/UX Design Quiz",
        description: "Test your understanding of design principles, usability, and UX research methods.",
        type: "quiz", links: [
          "https://www.figma.com/resource-library/",
          "https://www.nngroup.com/articles/",
          "https://dribbble.com/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What does UX stand for?", type: "option", options: ["User Experience", "User Extension", "Unified Xperience", "Universal XML"], answer: "User Experience" },
          { question: "Which tool is commonly used for wireframing?", type: "option", options: ["Photoshop", "Figma", "VS Code", "Chrome"], answer: "Figma" },
          { question: "What is a low-fidelity prototype?", type: "option", options: ["Final polished design", "Basic sketch of layout", "Interactive animation", "Code implementation"], answer: "Basic sketch of layout" },
          { question: "Which principle emphasizes consistency in design?", type: "option", options: ["Hick's Law", "Fitts's Law", "Jakob's Law", "Gestalt Principles"], answer: "Jakob's Law" },
          { question: "What is the purpose of user testing?", type: "option", options: ["Validate design decisions", "Write code", "Create graphics", "Deploy app"], answer: "Validate design decisions" },
          { question: "What is a heuristic evaluation?", type: "option", options: ["Code review", "Usability inspection method", "Performance test", "Security audit"], answer: "Usability inspection method" },
          { question: "Which color model is used for digital screens?", type: "option", options: ["CMYK", "RGB", "RYB", "HSL"], answer: "RGB" },
          { question: "What does a sitemap show?", type: "option", options: ["Code structure", "Page hierarchy", "Server locations", "Network topology"], answer: "Page hierarchy" },
          { question: "What is an accessible design?", type: "option", options: ["Low-cost design", "Design usable by people with disabilities", "Fast-loading design", "Mobile-only design"], answer: "Design usable by people with disabilities" },
          { question: "What is a design system?", type: "option", options: ["Code library", "Collection of reusable components and guidelines", "Testing framework", "Color palette"], answer: "Collection of reusable components and guidelines" },
        ],
      },
      t("Mobile App Redesign", "Choose an existing mobile app with poor UX and redesign it in Figma. Conduct a heuristic evaluation (document 5+ usability issues), create low-fi wireframes for the improved flow, design high-fi mockups with proper color contrast and accessibility, and build an interactive prototype linking key screens.", ["https://www.figma.com/best-practices/", "https://www.nngroup.com/articles/ten-usability-heuristics/", "https://www.figma.com/community"]),
      t("Portfolio Website Design", "Design a personal portfolio website in Figma with 5+ pages (Home, About, Projects, Skills, Contact). Create a responsive layout for mobile and desktop, use auto-layout for components, add hover/interaction animations, and export as an interactive prototype to simulate real navigation.", ["https://www.figma.com/community", "https://dribbble.com/", "https://www.behance.net/tags/portfolio_website"]),
      t("E-commerce UX Design", "Design the complete user flow for an e-commerce app from product discovery to checkout. Create user personas, a sitemap, and user journey map. Design screens for: product listing with filters, product detail page, cart, checkout with address/payment forms, and order confirmation with email mockup.", ["https://www.nngroup.com/articles/ecommerce-usability/", "https://www.figma.com/templates/", "https://baymard.com/ux-benchmark"]),
      t("Dashboard UI Design", "Create a data dashboard UI design in Figma with KPIs, line charts, bar charts, data tables, and filter controls. Use a dark theme, ensure accessibility (WCAG contrast ratios), create reusable component variants, and prototype interactions like dropdown menus and date range selectors.", ["https://dribbble.com/search/dashboard", "https://www.figma.com/community/collections/dashboard-designs", "https://material.io/components/data-tables"]),
      t("Design System Creation", "Build a comprehensive design system in Figma including: typography scale, color palette (primary, secondary, neutral, semantic), button/input/card components with variants, icon library, spacing and grid system, and a usage guideline page. Document component properties and interactions clearly.", ["https://www.figma.com/plugin-docs/", "https://www.designsystems.com/", "https://material.io/design"]),
    ],
  },
  {
    id: "path_appdev", title: "App Development", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Develop cross-platform mobile applications using React Native and modern mobile development tools.",
    features: ["React Native basics", "Navigation & state management", "API integration", "App deployment"],
    projects: [
      {
        title: "App Development Quiz",
        description: "Test your knowledge of mobile app development, React Native, and cross-platform concepts.",
        type: "quiz", links: [
          "https://reactnative.dev/docs/getting-started",
          "https://docs.expo.dev/",
          "https://medium.com/tag/react-native",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which framework is used for cross-platform mobile apps?", type: "option", options: ["React Native", "React JS", "Node.js", "Express"], answer: "React Native" },
          { question: "What is the core component for displaying text in React Native?", type: "option", options: ["<div>", "<span>", "<Text>", "<Label>"], answer: "<Text>" },
          { question: "Which hook manages state in React?", type: "option", options: ["useEffect", "useState", "useReducer", "useMemo"], answer: "useState" },
          { question: "What is the default navigation library for React Native?", type: "option", options: ["React Router", "React Navigation", "Native Router", "Stack Navigator"], answer: "React Navigation" },
          { question: "How do you style components in React Native?", type: "option", options: ["CSS files", "StyleSheet API", "Tailwind", "Bootstrap"], answer: "StyleSheet API" },
          { question: "What is an API?", type: "option", options: ["App Programming Interface", "Application Programming Interface", "Automated Program Integration", "Application Process Integration"], answer: "Application Programming Interface" },
          { question: "Which platform stores React Native apps?", type: "option", options: ["App Store & Play Store", "npm registry", "GitHub", "Docker Hub"], answer: "App Store & Play Store" },
          { question: "What does 'state' represent in React?", type: "option", options: ["Static data", "Dynamic data that triggers re-renders", "Database", "API endpoint"], answer: "Dynamic data that triggers re-renders" },
          { question: "Which component is used for scrolling lists?", type: "option", options: ["ListView", "ScrollView", "FlatView", "ListComponent"], answer: "ScrollView" },
          { question: "What is the purpose of Expo in React Native?", type: "option", options: ["Build tool and development platform", "Database", "State management", "Testing framework"], answer: "Build tool and development platform" },
        ],
      },
      t("Task Manager App", "Build a cross-platform task manager app in React Native with Expo. Implement: add/edit/delete tasks with title and due date, mark tasks as complete, filter by status (All/Active/Completed), persist data using AsyncStorage, and style with StyleSheet for iOS and Android.", ["https://reactnative.dev/docs/tutorial", "https://docs.expo.dev/tutorial/create-your-first-app/", "https://reactnative.dev/docs/asyncstorage"]),
      t("Weather App", "Create a React Native weather app that fetches live weather from OpenWeatherMap API. Use Geolocation API to auto-detect user city, display temperature, humidity, wind speed, and 5-day forecast with FlatList. Show weather icons and dynamic backgrounds based on conditions.", ["https://reactnative.dev/docs/network", "https://openweathermap.org/api", "https://docs.expo.dev/versions/latest/sdk/location/"]),
      t("Recipe Finder App", "Build a recipe finder app using the Edamam or Spoonacular API. Implement search with ingredient filters, display recipe cards with images, cooking time, and difficulty. Add a Favorites screen using AsyncStorage and a detailed recipe view with step-by-step instructions.", ["https://docs.expo.dev/tutorial/", "https://reactnative.dev/docs/flatlist", "https://developer.edamam.com/edamam-docs-recipe-api"]),
      t("Fitness Tracker", "Develop a fitness tracker using Expo Sensors API. Track step count with pedometer, log workouts (type, duration, calories), display progress charts with react-native-chart-kit, and store history using AsyncStorage. Show daily/weekly progress summary on home screen.", ["https://docs.expo.dev/versions/latest/sdk/sensors/", "https://reactnative.dev/docs/asyncstorage", "https://github.com/indiespirit/react-native-chart-kit"]),
      t("Chat Application", "Build a real-time chat app in React Native using Firebase Firestore for message storage and Cloud Messaging for push notifications. Implement: user auth with Firebase Auth, list conversations, send/receive messages with timestamps, online status indicators, and image sharing with Firebase Storage.", ["https://firebase.google.com/docs/cloud-messaging", "https://reactnative.dev/docs/networking", "https://rnfirebase.io/"]),
    ],
  },
  {
    id: "path_cloud", title: "Cloud Computing", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Learn cloud infrastructure, containerization, and DevOps practices with major cloud providers.",
    features: ["AWS essentials", "Docker containers", "CI/CD pipelines", "Infrastructure as code"],
    projects: [
      {
        title: "Cloud Computing Quiz",
        description: "Test your understanding of cloud concepts, AWS services, and DevOps tools.",
        type: "quiz", links: [
          "https://aws.amazon.com/getting-started/",
          "https://docs.docker.com/get-started/",
          "https://www.digitalocean.com/community/tutorials",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which cloud model provides virtual machines and storage?", type: "option", options: ["SaaS", "PaaS", "IaaS", "FaaS"], answer: "IaaS" },
          { question: "What is Docker used for?", type: "option", options: ["Database management", "Containerization", "Code editing", "Testing"], answer: "Containerization" },
          { question: "Which AWS service provides virtual servers?", type: "option", options: ["S3", "Lambda", "EC2", "RDS"], answer: "EC2" },
          { question: "What does CI/CD stand for?", type: "option", options: ["Continuous Integration / Continuous Deployment", "Code Integration / Code Deployment", "Continuous Improvement / Continuous Delivery", "Code Inspection / Code Debugging"], answer: "Continuous Integration / Continuous Deployment" },
          { question: "What is Infrastructure as Code?", type: "option", options: ["Writing documentation", "Managing infrastructure with config files", "Manual server setup", "Cloud billing"], answer: "Managing infrastructure with config files" },
          { question: "Which tool is used for container orchestration?", type: "option", options: ["Docker Compose", "Kubernetes", "Terraform", "Ansible"], answer: "Kubernetes" },
          { question: "What does S3 stand for in AWS?", type: "option", options: ["Simple Storage Service", "System Storage Solution", "Secure Storage Service", "Standard Storage System"], answer: "Simple Storage Service" },
          { question: "Which deployment strategy replaces instances gradually?", type: "option", options: ["Blue-green", "Rolling", "Canary", "All at once"], answer: "Rolling" },
          { question: "What is a load balancer used for?", type: "option", options: ["Distribute traffic across servers", "Balance storage", "Optimize queries", "Secure network"], answer: "Distribute traffic across servers" },
          { question: "Which cloud provider offers Lambda functions?", type: "option", options: ["Google Cloud", "AWS", "Azure", "DigitalOcean"], answer: "AWS" },
        ],
      },
      t("Cloud Deployed Portfolio", "Containerize a simple web app (Python Flask or Node.js) with Docker. Write a Dockerfile, build the image, push to Docker Hub. Deploy on AWS EC2 or Elastic Beanstalk with a CI/CD pipeline using GitHub Actions. Include health check endpoint and environment configuration.", ["https://docs.docker.com/get-started/", "https://aws.amazon.com/getting-started/hands-on/", "https://docs.github.com/en/actions/learn-github-actions"]),
      t("Serverless API", "Build a serverless REST API using AWS Lambda with Python/Node.js, API Gateway (REST or HTTP), and DynamoDB for data storage. Implement CRUD operations, add request validation, set up CloudWatch logging, and test with Postman or curl. Use SAM or Serverless Framework for deployment.", ["https://aws.amazon.com/lambda/getting-started/", "https://docs.aws.amazon.com/apigateway/", "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GettingStartedDynamoDB.html"]),
      t("Auto-Scaling Setup", "Configure an auto-scaling group in AWS EC2 with a load balancer for a web application. Create a launch template with user data script, set scaling policies based on CPU utilization (scale out at >70%, scale in at <30%), test with a load generator, and verify in CloudWatch metrics.", ["https://docs.aws.amazon.com/autoscaling/", "https://docs.aws.amazon.com/elasticloadbalancing/", "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html"]),
      t("Monitoring Stack", "Set up Prometheus and Grafana on a cloud VM. Configure Prometheus to scrape metrics from a sample application (Node Exporter), set up Grafana dashboards for CPU, memory, disk, and network, configure alert rules for high resource usage, and test email alert notifications.", ["https://prometheus.io/docs/introduction/overview/", "https://grafana.com/docs/grafana/latest/getting-started/", "https://github.com/prometheus/node_exporter"]),
      t("Backup & Disaster Recovery", "Design and implement a backup strategy using AWS services. Set up S3 lifecycle policies for automated backups, configure RDS automated snapshots with retention, create cross-region replication for critical data, document a disaster recovery runbook with RTO/RPO targets, and test a full restore.", ["https://docs.aws.amazon.com/aws-backup/", "https://aws.amazon.com/s3/features/", "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateSnapshot.html"]),
    ],
  },
  {
    id: "path_cyber", title: "Cybersecurity", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Understand security principles, ethical hacking techniques, and network defense strategies.",
    features: ["Network security fundamentals", "Ethical hacking", "Cryptography", "Incident response"],
    projects: [
      {
        title: "Cybersecurity Quiz",
        description: "Test your knowledge of cybersecurity concepts, threats, and defense mechanisms.",
        type: "quiz", links: [
          "https://tryhackme.com/",
          "https://owasp.org/www-project-top-ten/",
          "https://www.cybrary.it/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What is phishing?", type: "option", options: ["Network attack", "Social engineering via fake messages", "Physical security breach", "Database attack"], answer: "Social engineering via fake messages" },
          { question: "Which tool is used for penetration testing?", type: "option", options: ["Docker", "Kali Linux", "VS Code", "Node.js"], answer: "Kali Linux" },
          { question: "What does DDoS stand for?", type: "option", options: ["Distributed Denial of Service", "Data Destruction of System", "Dynamic Domain Security", "Direct Denial of Service"], answer: "Distributed Denial of Service" },
          { question: "Which encryption method uses a single key?", type: "option", options: ["Asymmetric encryption", "Symmetric encryption", "Hashing", "Digital signature"], answer: "Symmetric encryption" },
          { question: "What is a firewall used for?", type: "option", options: ["Speed up network", "Monitor and filter traffic", "Store passwords", "Encrypt data"], answer: "Monitor and filter traffic" },
          { question: "Which OWASP Top 10 vulnerability involves injecting SQL?", type: "option", options: ["XSS", "SQL Injection", "CSRF", "SSRF"], answer: "SQL Injection" },
          { question: "What is a zero-day vulnerability?", type: "option", options: ["Old vulnerability", "Unknown vulnerability with no patch", "Patched vulnerability", "Low severity bug"], answer: "Unknown vulnerability with no patch" },
          { question: "What does HTTPS stand for?", type: "option", options: ["HyperText Transfer Protocol Secure", "High Transfer Protocol Secure", "HyperText Transmission Protocol", "High Transfer Standard"], answer: "HyperText Transfer Protocol Secure" },
          { question: "Which principle ensures data is not modified by unauthorized parties?", type: "option", options: ["Confidentiality", "Integrity", "Availability", "Authentication"], answer: "Integrity" },
          { question: "What is multi-factor authentication?", type: "option", options: ["Multiple passwords", "Using 2+ verification methods", "Single sign-on", "Biometric only"], answer: "Using 2+ verification methods" },
        ],
      },
      t("Security Audit Report", "Conduct a simulated security audit of a web application using OWASP Testing Guide. Perform reconnaissance, test for OWASP Top 10 vulnerabilities (XSS, SQLi, CSRF, IDOR), document findings with risk ratings, and write remediation steps. Submit a professional PDF audit report.", ["https://owasp.org/www-project-web-security-testing-guide/", "https://tryhackme.com/module/introduction-to-cyber-security", "https://owasp.org/www-project-top-ten/"]),
      t("Penetration Testing Lab", "Set up a penetration testing lab with VirtualBox or VMware. Install Kali Linux and a deliberately vulnerable VM (Metasploitable 2 or VulnHub). Perform: network scanning with Nmap, service enumeration, exploitation with Metasploit, privilege escalation, and document findings with proof-of-concept screenshots.", ["https://www.vulnhub.com/", "https://www.kali.org/docs/", "https://docs.rapid7.com/metasploit/"]),
      t("Network Security Scanner", "Build a network security scanner in Python using socket and scapy libraries. Implement: TCP/UDP port scanning (connect, SYN, FIN scans), service detection via banner grabbing, OS fingerprinting with TTL analysis, and output results in formatted JSON/CSV. Add threading for faster scanning.", ["https://nmap.org/docs.html", "https://docs.python.org/3/library/socket.html", "https://scapy.readthedocs.io/"]),
      t("SIEM Implementation", "Set up Wazuh SIEM on a Linux server. Install Wazuh manager and indexer, add agents on client machines (Windows/Linux), configure log collection (sysmon, auditd), create custom alert rules for failed logins and malware detection, and view dashboards in the Wazuh Kibana plugin.", ["https://wazuh.com/get-started/", "https://www.splunk.com/en_us/training.html", "https://documentation.wazuh.com/current/getting-started/architecture.html"]),
      t("Incident Response Plan", "Create a comprehensive incident response plan based on NIST CSF framework. Document phases: Preparation, Detection & Analysis, Containment, Eradication, Recovery, Post-Incident Activity. Write playbooks for 5 scenarios: ransomware, data breach, DDoS, insider threat, and phishing campaign. Include templates for incident reports.", ["https://www.nist.gov/cyberframework", "https://attack.mitre.org/", "https://www.sans.org/white-papers/33901/"]),
    ],
  },
  {
    id: "path_fullstack", title: "Full Stack Development", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Build complete web applications from frontend to backend with databases and deployment.",
    features: ["Frontend frameworks", "Backend APIs", "Database integration", "Deployment"],
    projects: [
      {
        title: "Full Stack Development Quiz",
        description: "Test your understanding of full stack development including frontend, backend, and databases.",
        type: "quiz", links: [
          "https://developer.mozilla.org/en-US/docs/Learn",
          "https://nodejs.org/en/docs/",
          "https://www.postgresql.org/docs/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What is a REST API?", type: "option", options: ["Architectural style for APIs", "Database type", "Frontend library", "CSS framework"], answer: "Architectural style for APIs" },
          { question: "Which backend runtime is built on Chrome's V8 engine?", type: "option", options: ["Python", "Node.js", "Java", "PHP"], answer: "Node.js" },
          { question: "What does CRUD stand for?", type: "option", options: ["Create, Read, Update, Delete", "Compile, Run, Update, Deploy", "Code, Review, Upload, Debug", "Connect, Request, Use, Disconnect"], answer: "Create, Read, Update, Delete" },
          { question: "Which database is a NoSQL document store?", type: "option", options: ["MySQL", "PostgreSQL", "MongoDB", "SQLite"], answer: "MongoDB" },
          { question: "What is middleware in Express.js?", type: "option", options: ["Database layer", "Functions that process requests", "Template engine", "Build tool"], answer: "Functions that process requests" },
          { question: "Which HTTP method is used to update data?", type: "option", options: ["GET", "POST", "PUT", "DELETE"], answer: "PUT" },
          { question: "What is CORS used for?", type: "option", options: ["Cross-Origin Resource Sharing", "Database optimization", "CSS framework", "Code formatting"], answer: "Cross-Origin Resource Sharing" },
          { question: "Which tool manages package dependencies in Node.js?", type: "option", options: ["npm", "pip", "gem", "cargo"], answer: "npm" },
          { question: "What is a database migration?", type: "option", options: ["Moving data between servers", "Version-controlled schema changes", "Query optimization", "Backup"], answer: "Version-controlled schema changes" },
          { question: "Which architecture separates frontend from backend?", type: "option", options: ["Monolithic", "Client-server", "Peer-to-peer", "Event-driven"], answer: "Client-server" },
        ],
      },
      t("E-commerce Web Application", "Build a full-stack e-commerce web app using React frontend, Node.js/Express backend with REST API, and MongoDB/PostgreSQL. Implement: user authentication (JWT), product listing with search/filter, shopping cart with persistent state, checkout with order creation, and admin dashboard for product management.", ["https://nodejs.org/en/docs/guides/", "https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs", "https://www.mongodb.com/docs/"]),
      t("Blog Platform", "Create a full-stack blog platform with React frontend and Express/MongoDB backend. Implement: user registration/login with bcrypt, rich text editor (Quill.js or Markdown), CRUD for posts with categories and tags, comments system with threading, and image upload with multer. Deploy on Vercel + Render.", ["https://www.mongodb.com/docs/", "https://expressjs.com/en/guide/routing.html", "https://jwt.io/introduction"]),
      t("Social Media API", "Build a RESTful API for a social media platform using Node.js, Express, and PostgreSQL with Prisma ORM. Implement: user profiles, posts with images, like/unlike, follow/unfollow, news feed generation, and notifications. Add pagination, rate limiting, and API documentation with Swagger.", ["https://expressjs.com/en/advanced/best-practice-security.html", "https://www.postgresql.org/docs/", "https://www.prisma.io/docs"]),
      t("Real-time Chat App", "Develop a real-time chat app using Socket.io with Node.js backend and React frontend. Implement: multiple chat rooms, user online/offline status, message history stored in MongoDB, typing indicators, file/image sharing with preview, and emoji picker. Deploy with Render and Vercel.", ["https://socket.io/docs/v4/", "https://developer.mozilla.org/en-US/docs/Web/API/WebSocket", "https://www.mongodb.com/docs/"]),
      t("Project Management Tool", "Build a Kanban-style project management app with React frontend using react-beautiful-dnd for drag-and-drop. Backend with Node.js/Express and MongoDB. Implement: boards, lists, cards with due dates and assignees, activity log, comments, and team member invitations. Use React context for state management.", ["https://reactjs.org/docs/hooks-intro.html", "https://www.mongodb.com/docs/manual/aggregation/", "https://github.com/atlassian/react-beautiful-dnd"]),
    ],
  },
  {
    id: "path_devops", title: "DevOps Engineering", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Master DevOps practices including automation, monitoring, and cloud infrastructure management.",
    features: ["Version control & Git", "CI/CD pipelines", "Container orchestration", "Monitoring & logging"],
    projects: [
      {
        title: "DevOps Quiz",
        description: "Test your knowledge of DevOps tools, practices, and infrastructure automation.",
        type: "quiz", links: [
          "https://docs.github.com/en/actions",
          "https://kubernetes.io/docs/tutorials/",
          "https://developer.hashicorp.com/terraform/tutorials",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which tool is used for version control?", type: "option", options: ["Docker", "Git", "Jenkins", "Ansible"], answer: "Git" },
          { question: "What is a CI/CD pipeline?", type: "option", options: ["Automated build-test-deploy process", "Manual deployment", "Code review process", "Testing framework"], answer: "Automated build-test-deploy process" },
          { question: "Which tool is used for configuration management?", type: "option", options: ["Docker", "Kubernetes", "Ansible", "GitHub"], answer: "Ansible" },
          { question: "What is Terraform used for?", type: "option", options: ["Containerization", "Infrastructure as Code", "Monitoring", "Load testing"], answer: "Infrastructure as Code" },
          { question: "Which monitoring tool collects metrics and logs?", type: "option", options: ["Jenkins", "Prometheus", "Docker", "Git"], answer: "Prometheus" },
          { question: "What does SLA stand for?", type: "option", options: ["Service Level Agreement", "Service Layer Architecture", "System Load Average", "Software License Agreement"], answer: "Service Level Agreement" },
          { question: "Which branching strategy uses feature branches?", type: "option", options: ["Git Flow", "Trunk-based", "Main-only", "Tag-based"], answer: "Git Flow" },
          { question: "What is a canary deployment?", type: "option", options: ["Deploy to all at once", "Gradual rollout to subset of users", "Rollback deployment", "Blue-green deployment"], answer: "Gradual rollout to subset of users" },
          { question: "Which tool visualizes containerized applications?", type: "option", options: ["Docker Compose", "Kubernetes Dashboard", "Terraform", "Ansible Tower"], answer: "Kubernetes Dashboard" },
          { question: "What is the purpose of log aggregation?", type: "option", options: ["Delete old logs", "Centralize logs for analysis", "Encrypt logs", "Compress logs"], answer: "Centralize logs for analysis" },
        ],
      },
      t("CI/CD Pipeline Setup", "Design and implement a CI/CD pipeline using GitHub Actions for a Node.js/React app. Stages: lint with ESLint, run unit tests with Jest, build Docker image, push to Docker Hub, deploy to AWS EC2 or DigitalOcean via SSH. Include Slack notifications on failure and version tagging.", ["https://docs.github.com/en/actions/learn-github-actions", "https://docker.github.io/get-started/", "https://docs.docker.com/ci-cd/github-actions/"]),
      t("Docker Compose Multi-Tier App", "Set up a multi-service app with Docker Compose: React frontend, Node.js/Express backend, PostgreSQL database, and Nginx reverse proxy. Configure custom networks for service isolation, named volumes for persistent data, environment variables via .env, and health checks for each service.", ["https://docs.docker.com/compose/", "https://docs.docker.com/compose/networking/", "https://docs.docker.com/compose/environment-variables/"]),
      t("Kubernetes Cluster Setup", "Deploy a Kubernetes cluster locally with Minikube or Kind. Write YAML manifests for: Deployment with replicas, Service (ClusterIP + LoadBalancer), ConfigMap and Secret for configuration, Ingress controller with TLS, HorizontalPodAutoscaler based on CPU, and persistent volume claims for stateful apps.", ["https://kubernetes.io/docs/tutorials/kubernetes-basics/", "https://minikube.sigs.k8s.io/docs/", "https://kind.sigs.k8s.io/"]),
      t("Infrastructure as Code with Terraform", "Write Terraform configurations to provision AWS resources: VPC with public/private subnets, EC2 instance with security group, S3 bucket with versioning, RDS MySQL instance, and IAM roles. Use Terraform Cloud for state management and variables for environment-specific configs.", ["https://developer.hashicorp.com/terraform/tutorials", "https://registry.terraform.io/providers/hashicorp/aws/latest/docs", "https://developer.hashicorp.com/terraform/language/state"]),
      t("Monitoring with Prometheus + Grafana", "Set up full monitoring stack: Prometheus for metric collection from application and infrastructure (Node Exporter, cAdvisor), Grafana with pre-built dashboards for CPU/memory/disk/network, configure alerting rules in Prometheus, send alerts via Slack/Email, and add Loki for log aggregation.", ["https://prometheus.io/docs/prometheus/latest/getting_started/", "https://grafana.com/docs/grafana/latest/dashboards/", "https://grafana.com/oss/loki/"]),
    ],
  },
  {
    id: "path_db", title: "Database Management", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Design, query, and manage relational and NoSQL databases for modern applications.",
    features: ["SQL fundamentals", "Database design & normalization", "Indexes & query optimization", "NoSQL databases"],
    projects: [
      {
        title: "Database Management Quiz",
        description: "Test your understanding of database design, SQL queries, and optimization techniques.",
        type: "quiz", links: [
          "https://www.postgresql.org/docs/current/tutorial.html",
          "https://sqlzoo.net/",
          "https://www.db-engines.com/en/ranking",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What is a primary key?", type: "option", options: ["Unique identifier for a row", "Foreign reference", "Index type", "Constraint check"], answer: "Unique identifier for a row" },
          { question: "Which SQL statement creates a new table?", type: "option", options: ["CREATE TABLE", "MAKE TABLE", "NEW TABLE", "ADD TABLE"], answer: "CREATE TABLE" },
          { question: "What is database normalization?", type: "option", options: ["Organizing data to reduce redundancy", "Encrypting data", "Backing up data", "Indexing data"], answer: "Organizing data to reduce redundancy" },
          { question: "Which clause filters grouped data?", type: "option", options: ["WHERE", "HAVING", "FILTER", "GROUP"], answer: "HAVING" },
          { question: "What is an index used for?", type: "option", options: ["Speed up queries", "Encrypt data", "Backup data", "Normalize data"], answer: "Speed up queries" },
          { question: "Which type of relationship uses a foreign key?", type: "option", options: ["One-to-one", "One-to-many", "Many-to-many", "All of the above"], answer: "All of the above" },
          { question: "What does ACID stand for?", type: "option", options: ["Atomicity, Consistency, Isolation, Durability", "Automated, Consistent, Isolated, Durable", "Atomic, Complete, Isolated, Durable", "Access, Control, Integrity, Data"], answer: "Atomicity, Consistency, Isolation, Durability" },
          { question: "Which NoSQL database stores data as JSON-like documents?", type: "option", options: ["MySQL", "PostgreSQL", "MongoDB", "Redis"], answer: "MongoDB" },
          { question: "What is a JOIN in SQL?", type: "option", options: ["Combining rows from two tables", "Creating a backup", "Sorting data", "Filtering results"], answer: "Combining rows from two tables" },
          { question: "What does a transaction do?", type: "option", options: ["Groups operations as a single unit", "Deletes data", "Creates indexes", "Backs up database"], answer: "Groups operations as a single unit" },
        ],
      },
      t("Database Design Project", "Design a fully normalized (3NF) database schema for an e-commerce platform. Create an ER diagram using dbdiagram.io or draw.io, write DDL scripts in PostgreSQL with primary keys, foreign keys, check constraints, and indexes. Include tables: users, products, categories, orders, order_items, reviews, and payments.", ["https://www.postgresql.org/docs/current/ddl.html", "https://sqlzoo.net/wiki/SELECT_from_Nobel_Tutorial", "https://dbdiagram.io/"]),
      t("Library Database System", "Create a library database in PostgreSQL with tables: books (ISBN, title, author, genre), members (ID, name, join date), loans (book_id, member_id, issue_date, due_date, return_date), and fines (loan_id, amount, paid). Write queries for overdue books, popular authors, and member borrowing history.", ["https://www.postgresql.org/docs/current/dml.html", "https://www.postgresql.org/docs/current/queries.html", "https://www.postgresql.org/docs/current/functions-aggregate.html"]),
      t("Query Optimization Project", "Learn query optimization using PostgreSQL's EXPLAIN ANALYZE. Create a test dataset with 100K+ rows, write slow queries without indexes, analyze query plans (seq scan vs index scan, nested loop vs hash join), create appropriate indexes (B-tree, partial, covering), and measure performance improvement with timing comparisons.", ["https://www.postgresql.org/docs/current/indexes.html", "https://www.postgresql.org/docs/current/performance-tips.html", "https://use-the-index-luke.com/"]),
      t("NoSQL Migration", "Migrate a relational e-commerce schema to MongoDB document structure. Design embedded vs referenced data models for users/orders/products, write MongoDB schema validation rules, create compound indexes for common queries, and write aggregation pipelines for: order totals, top products, monthly revenue, and customer lifetime value.", ["https://www.mongodb.com/docs/manual/aggregation/", "https://www.mongodb.com/docs/manual/data-modeling/", "https://www.mongodb.com/docs/manual/indexes/"]),
      t("Data Warehouse Design", "Design a star schema data warehouse for a retail analytics platform. Create fact tables (sales_fact with measures: revenue, quantity, discount) and dimension tables (product_dim, customer_dim, store_dim, time_dim). Write dimensional queries with GROUP BY ROLLUP, implement slowly changing dimensions (SCD Type 2), and create materialized views for performance.", ["https://www.postgresql.org/docs/current/datatype.html", "https://www.kimballgroup.com/data-warehouse-bus-architecture/", "https://www.postgresql.org/docs/current/rules-materializedviews.html"]),
    ],
  },
  {
    id: "path_blockchain", title: "Blockchain Development", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Learn blockchain fundamentals, smart contracts, and decentralized application development.",
    features: ["Blockchain fundamentals", "Smart contracts", "Web3 & dApps", "Solidity programming"],
    projects: [
      {
        title: "Blockchain Quiz",
        description: "Test your knowledge of blockchain technology, smart contracts, and decentralized applications.",
        type: "quiz", links: [
          "https://ethereum.org/en/developers/docs/",
          "https://docs.soliditylang.org/",
          "https://cryptozombies.io/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What is a blockchain?", type: "option", options: ["Distributed ledger", "Centralized database", "File storage", "Messaging protocol"], answer: "Distributed ledger" },
          { question: "Which language is used for Ethereum smart contracts?", type: "option", options: ["Python", "Solidity", "JavaScript", "Rust"], answer: "Solidity" },
          { question: "What is a dApp?", type: "option", options: ["Desktop Application", "Decentralized Application", "Database App", "Dynamic App"], answer: "Decentralized Application" },
          { question: "What is mining in blockchain?", type: "option", options: ["Extracting data", "Validating transactions and creating blocks", "Deleting blocks", "Encrypting data"], answer: "Validating transactions and creating blocks" },
          { question: "Which consensus mechanism does Bitcoin use?", type: "option", options: ["Proof of Stake", "Proof of Work", "Delegated Proof of Stake", "Proof of Authority"], answer: "Proof of Work" },
          { question: "What is a wallet address in blockchain?", type: "option", options: ["Physical wallet ID", "Public identifier for transactions", "Private key", "Smart contract ID"], answer: "Public identifier for transactions" },
          { question: "What does Web3 refer to?", type: "option", options: ["Third version of web", "Decentralized internet", "Faster internet", "Mobile web"], answer: "Decentralized internet" },
          { question: "What is a gas fee in Ethereum?", type: "option", options: ["Subscription fee", "Transaction processing fee", "Storage fee", "Registration fee"], answer: "Transaction processing fee" },
          { question: "Which network is Ethereum's test network?", type: "option", options: ["Mainnet", "Sepolia", "Bitcoin", "Polygon"], answer: "Sepolia" },
          { question: "What is an NFT?", type: "option", options: ["Non-Fungible Token", "Network File Transfer", "New Financial Transaction", "Node Function Test"], answer: "Non-Fungible Token" },
        ],
      },
      t("Decentralized Voting DApp", "Build a decentralized voting dApp with a Solidity smart contract (candidates, vote function with double-vote prevention, vote count, and winner declaration). Develop a React/ethers.js frontend to connect MetaMask, display candidates, cast votes, and show results. Deploy on Sepolia testnet and verify contract on Etherscan.", ["https://ethereum.org/en/developers/tutorials/", "https://docs.soliditylang.org/en/latest/introduction-to-smart-contracts.html", "https://docs.ethers.org/v5/"]),
      t("NFT Marketplace", "Create an NFT marketplace using OpenZeppelin ERC-721. Write Solidity contracts for minting NFTs with metadata URI, listing with fixed price, buying with payment split (creator + platform fee), and cancel listing. Build a React frontend with ethers.js, IPFS (via Pinata) for metadata storage, and deploy on Sepolia.", ["https://eips.ethereum.org/EIPS/eip-721", "https://docs.openzeppelin.com/contracts/", "https://docs.ipfs.tech/"]),
      t("Token Creation", "Deploy an ERC-20 token using OpenZeppelin with custom features: mintable (only owner), burnable, pausable for emergencies, and snapshots for governance voting. Write Hardhat deployment scripts and tests, verify on Etherscan, and create a simple dApp to display token balance and transfer functionality.", ["https://eips.ethereum.org/EIPS/eip-20", "https://docs.openzeppelin.com/contracts/4.x/erc20", "https://hardhat.org/docs"]),
      t("DeFi Lending Protocol", "Build a simplified DeFi lending protocol: users can deposit ETH as collateral, borrow a stablecoin against it (max 70% LTV), repay with interest, and liquidate undercollateralized positions. Write Solidity contracts with price oracle integration (Chainlink), test with Hardhat, and deploy on Sepolia.", ["https://ethereum.org/en/developers/docs/defi/", "https://docs.openzeppelin.com/contracts/4.x/erc4626", "https://docs.chain.link/data-feeds/"]),
      t("Multi-Sig Wallet", "Develop a multi-signature wallet contract where a group of owners must approve transactions (e.g., 3 of 5). Implement: submit transaction, confirm/reject by owners, execute when threshold reached, add/remove owners (by existing owners), and transaction history tracking. Write comprehensive Hardhat tests.", ["https://ethereum.org/en/developers/docs/smart-contracts/", "https://docs.openzeppelin.com/contracts/4.x/api/access", "https://hardhat.org/docs"]),
    ],
  },
  {
    id: "path_digital_marketing", title: "Digital Marketing", duration: "6 Weeks", paymentAmount: 200, paymentAmountReferral: 180,
    description: "Master digital marketing strategies including SEO, social media, content marketing, and analytics.",
    features: ["SEO & SEM", "Social media marketing", "Content strategy", "Analytics & reporting"],
    projects: [
      {
        title: "Digital Marketing Quiz",
        description: "Test your understanding of digital marketing channels, strategies, and analytics tools.",
        type: "quiz", links: [
          "https://moz.com/beginners-guide-to-seo",
          "https://analytics.google.com/analytics/academy/",
          "https://ahrefs.com/blog/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What does SEO stand for?", type: "option", options: ["Search Engine Optimization", "Social Engagement Optimization", "Systematic Engine Output", "Site Enhancement Operation"], answer: "Search Engine Optimization" },
          { question: "Which metric measures website traffic from search engines?", type: "option", options: ["Bounce rate", "Organic traffic", "Click-through rate", "Conversion rate"], answer: "Organic traffic" },
          { question: "What is a KPI in digital marketing?", type: "option", options: ["Key Performance Indicator", "Key Product Index", "Knowledge Processing Input", "Key Program Interface"], answer: "Key Performance Indicator" },
          { question: "Which platform is best for B2B marketing?", type: "option", options: ["Instagram", "LinkedIn", "TikTok", "Snapchat"], answer: "LinkedIn" },
          { question: "What is A/B testing?", type: "option", options: ["Comparing two versions of content", "Testing network speed", "Database testing", "Code testing"], answer: "Comparing two versions of content" },
          { question: "What does CTR stand for?", type: "option", options: ["Click-Through Rate", "Cost per Task Ratio", "Customer Tracking Report", "Content Testing Ratio"], answer: "Click-Through Rate" },
          { question: "What is a call-to-action (CTA)?", type: "option", options: ["Customer phone call", "Prompt for user action", "Legal requirement", "Billing term"], answer: "Prompt for user action" },
          { question: "Which tool is used for keyword research?", type: "option", options: ["Google Analytics", "Google Keyword Planner", "Google Search Console", "Google Trends"], answer: "Google Keyword Planner" },
          { question: "What is email marketing?", type: "option", options: ["Sending promotional emails", "Email encryption", "Email storage", "Email protocol"], answer: "Sending promotional emails" },
          { question: "What is a landing page?", type: "option", options: ["Homepage", "Page designed for conversions", "Blog page", "Contact page"], answer: "Page designed for conversions" },
        ],
      },
      t("Digital Marketing Campaign", "Plan and execute a complete digital marketing campaign for a product or service. Define SMART goals, target audience personas, channel mix (SEO, social media, email, paid ads), content calendar, budget allocation, and KPI tracking dashboard. Write a 5-page campaign plan document with expected ROI calculations.", ["https://moz.com/learn/seo", "https://analytics.google.com/analytics/academy/", "https://ahrefs.com/blog/digital-marketing-strategy/"]),
      t("SEO Audit Report", "Conduct a comprehensive SEO audit of a real website using tools: Google Search Console for index coverage, Google PageSpeed Insights for performance, Ahrefs/Screaming Frog for technical SEO (broken links, meta tags, sitemap, robots.txt). Document findings with screenshots and provide prioritized recommendations for improvement.", ["https://developers.google.com/search/docs", "https://ahrefs.com/blog/", "https://www.screamingfrog.co.uk/seo-spider/"]),
      t("Content Marketing Strategy", "Create a 90-day content marketing strategy for a brand. Define content pillars, target keywords for each pillar, content formats (blog posts, videos, infographics, social posts), editorial calendar with publishing schedule, distribution channels, and success metrics (traffic, engagement, leads). Create 3 sample content pieces.", ["https://ahrefs.com/blog/content-marketing/", "https://moz.com/blog", "https://blog.hubspot.com/marketing/content-marketing-strategy"]),
      t("Social Media Analytics", "Analyze social media performance data from Facebook/Instagram Business Suite or Twitter Analytics. Create a report with: follower growth trends, top-performing posts by engagement rate, best posting times, audience demographics, competitor benchmark analysis, and actionable recommendations to improve reach and engagement.", ["https://analytics.google.com/analytics/academy/", "https://business.facebook.com/analytics", "https://analytics.twitter.com/"]),
      t("Email Marketing Campaign", "Design and execute an email marketing campaign using Mailchimp or SendGrid. Create: welcome sequence (3 emails), promotional campaign with A/B tested subject lines, segmented audience lists based on behavior, personalized content with merge tags, and performance report analyzing open rates, CTR, conversion rates, and unsubscribe rates.", ["https://mailchimp.com/help/", "https://blog.hubspot.com/marketing/email-marketing-guide", "https://docs.sendgrid.com/"]),
    ],
  },
];

const HOW_IT_WORKS = [
  { id: "step_1", step: 1, title: "Select Domain", description: "Choose your internship domain from available career paths." },
  { id: "step_2", step: 2, title: "Generate Offer", description: "Sign in with Google and complete your profile to receive an instant offer letter." },
  { id: "step_3", step: 3, title: "Complete Tasks", description: "Submit quizzes and projects through the student dashboard for review." },
  { id: "step_4", step: 4, title: "Get Certified", description: "Receive your verified completion certificate after admin review." },
];

const FAQS = [
  { id: "faq_1", question: "Are the internships really free?", answer: "Yes, all virtual internships on DEV/CRAFT are 100% free. No hidden charges." },
  { id: "faq_2", question: "Who can apply?", answer: "College students, recent graduates, and self-taught learners from any background can apply." },
  { id: "faq_3", question: "How is progress verified?", answer: "Submitted projects are reviewed from the admin dashboard. Our team verifies each submission." },
  { id: "faq_4", question: "Will I get a certificate?", answer: "Yes, after completing all projects and admin verification, you receive a verified completion certificate." },
  { id: "faq_5", question: "How long does the internship last?", answer: "Each domain is designed for 4 weeks, but you can work at your own pace." },
  { id: "faq_6", question: "How many domains can I enroll in?", answer: "You can enroll in any domain you're interested in. Each enrollment is separate." },
  { id: "faq_7", question: "What if I fail a quiz?", answer: "You can retake quizzes. The passing grade is 40%, and you can attempt as many times as needed." },
];

const TEMPLATES = {
  offer_letter: `<html><body style="font-family: Arial, sans-serif; padding: 40px;">
<h1 style="text-align: center;">INTERNSHIP OFFER LETTER</h1>
<hr>
<p><strong>Date:</strong> {{date}}</p>
<p><strong>Intern ID:</strong> {{internId}}</p>
<p>Dear <strong>{{name}}</strong>,</p>
<p>Congratulations! We are pleased to offer you a virtual internship position in <strong>{{domain}}</strong> at DEV/CRAFT.</p>
<p>This internship is 100% free and designed to help you gain practical experience through real-world projects. Upon successful completion, you will receive a verified certificate.</p>
<p>We look forward to seeing your progress!</p>
<br>
<p>Sincerely,<br><strong>DEV/CRAFT Team</strong></p>
</body></html>`,
  certificate: `<html><body style="font-family: Arial, sans-serif; text-align: center; padding: 60px;">
<h1 style="font-size: 28px;">CERTIFICATE OF COMPLETION</h1>
<hr>
<p style="font-size: 18px;">This is to certify that</p>
<h2 style="font-size: 32px;">{{name}}</h2>
<p style="font-size: 18px;">has successfully completed the virtual internship program</p>
<h3 style="font-size: 24px;">{{domain}}</h3>
<p style="font-size: 16px;">Intern ID: {{internId}} | Date: {{date}}</p>
<br><br>
<p>DEV/CRAFT — Virtual Internship Program</p>
</body></html>`,
};

const ABOUT_TEXT = "DEV/CRAFT is a 100% free virtual internship platform for college students and aspiring developers worldwide. We provide hands-on project-based learning across 16+ domains including Web Development, Python, Java, Data Science, Machine Learning, AI, UI/UX Design, App Development, Cloud Computing, Cybersecurity, and more. Our mission is to bridge the gap between academic learning and industry-ready skills through practical, real-world projects.";

async function seed() {
  console.log("Seeding Firestore...");

  const now = new Date().toISOString();

  // Career Paths - replace all documents
  const pathDocs = await db.collection("careerPaths").listDocuments();
  const pathBatch = db.batch();
  for (const doc of pathDocs) pathBatch.delete(doc);
  CAREER_PATHS.forEach((path) => {
    const ref = db.collection("careerPaths").doc(path.id);
    pathBatch.set(ref, { ...path, updatedAt: now });
  });
  await pathBatch.commit();
  console.log(`  ✓ Career paths (${CAREER_PATHS.length})`);

  // How It Works - replace all documents
  const worksDocs = await db.collection("howItWorks").listDocuments();
  const worksBatch = db.batch();
  for (const doc of worksDocs) worksBatch.delete(doc);
  HOW_IT_WORKS.forEach((step) => {
    const ref = db.collection("howItWorks").doc(step.id);
    worksBatch.set(ref, { ...step, updatedAt: now });
  });
  await worksBatch.commit();
  console.log(`  ✓ How it works (${HOW_IT_WORKS.length})`);

  // FAQs - replace all documents
  const faqDocs = await db.collection("faqs").listDocuments();
  const faqBatch = db.batch();
  for (const doc of faqDocs) faqBatch.delete(doc);
  FAQS.forEach((faq) => {
    const ref = db.collection("faqs").doc(faq.id);
    faqBatch.set(ref, { ...faq, updatedAt: now });
  });
  await faqBatch.commit();
  console.log(`  ✓ FAQs (${FAQS.length})`);

  // Templates - single doc in siteConfig collection
  await db.collection("siteConfig").doc("templates").set({ value: TEMPLATES, updatedAt: now });
  console.log("  ✓ Templates");

  // About Text
  await db.collection("siteConfig").doc("aboutText").set({ value: ABOUT_TEXT, updatedAt: now });
  console.log("  ✓ About text");

  console.log("\nSeeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
