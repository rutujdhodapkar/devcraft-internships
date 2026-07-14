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

const t = (title, desc, links, notes) => ({ title, description: desc, type: "text", links, notes: notes || "", submission: { type: "github", instructions: "Push your code to a GitHub repository and submit the repo link for review." }, quizQuestions: [], passingGrade: 100 });
const q = (title, desc, links, questions, notes) => ({ title, description: desc, type: "quiz", links, notes: notes || "", submission: { type: "platform", instructions: "Complete the quiz on the platform. Your score is recorded automatically." }, passingGrade: 40, quizQuestions: questions });

const CAREER_PATHS = [
  {
    id: "path_web", title: "Web Development", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Build responsive websites and web applications using HTML, CSS, JavaScript, and React.",
    features: ["HTML5 & CSS3 layouts", "JavaScript fundamentals", "React components & hooks", "Responsive design"],
    projects: [
      {
        title: "Web Development Fundamentals Quiz",
        description: "Test your understanding of web development basics including HTML, CSS, and JavaScript.",
        type: "quiz", links: [
          "https://developer.mozilla.org/en-US/docs/Learn",
          "https://www.freecodecamp.org/learn/responsive-web-design/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which HTML tag is used to link an external CSS file?", type: "option", options: ["<style>", "<link>", "<script>", "<meta>"], answer: "<link>" },
          { question: "Which CSS property makes a flex container?", type: "option", options: ["display: block", "display: flex", "position: relative", "float: left"], answer: "display: flex" },
          { question: "Which JavaScript keyword declares a block-scoped variable?", type: "option", options: ["var", "let", "int", "string"], answer: "let" },
          { question: "What does the DOM stand for?", type: "option", options: ["Document Object Model", "Data Object Model", "Document Oriented Model", "Display Object Management"], answer: "Document Object Model" },
          { question: "Which HTML tag creates a hyperlink?", type: "option", options: ["<link>", "<a>", "<href>", "<url>"], answer: "<a>" },
          { question: "What does HTML stand for?", type: "option", options: ["HyperText Markup Language", "HighText Machine Language", "HyperTool Markup Language", "None"], answer: "HyperText Markup Language" },
          { question: "Which tag is used for the largest heading in HTML?", type: "option", options: ["<heading>", "<h6>", "<h1>", "<head>"], answer: "<h1>" },
          { question: "Which CSS property changes text color?", type: "option", options: ["font-color", "text-color", "color", "foreground"], answer: "color" },
          { question: "What is the correct file extension for a JavaScript file?", type: "option", options: [".js", ".java", ".jvs", ".jscript"], answer: ".js" },
          { question: "Which tag is used to insert an image in HTML?", type: "option", options: ["<img>", "<image>", "<pic>", "<src>"], answer: "<img>" },
        ],
      },
      t("Personal Portfolio Page", "Build a simple one-page portfolio website with your name, bio, and skills using HTML and CSS.", ["https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web"], "Deploy for free on GitHub Pages or Netlify."),
      t("Product Card", "Create a product card displaying an image, name, price, and a button using HTML and CSS.", ["https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout"], "Use a placeholder image from picsum.photos."),
      t("JavaScript Calculator", "Build a calculator that can add, subtract, multiply, and divide using HTML buttons and JavaScript.", ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators"], "Start with just add and subtract, then add multiply and divide."),
      t("Landing Page", "Design a simple landing page with a header, features section, and a signup button using HTML, CSS, and basic JavaScript.", ["https://www.freecodecamp.org/news/how-to-build-a-landing-page-with-html-css-and-javascript/"], "Pick any product you like. Keep the design clean with 2-3 colors."),
      t("Weather Dashboard", "Fetch weather data from a free API using JavaScript and display temperature and conditions on a webpage.", ["https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API"], "Sign up for a free API key at OpenWeatherMap."),
    ],
  },
  {
    id: "path_python", title: "Python Development", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Master Python programming for scripting, automation, and backend development.",
    features: ["Python syntax & data types", "OOP concepts", "File handling & modules", "APIs & libraries"],
    projects: [
      {
        title: "Python Fundamentals Quiz",
        description: "Test your knowledge of Python syntax, data structures, and OOP concepts.",
        type: "quiz", links: [
          "https://docs.python.org/3/tutorial/",
          "https://www.w3schools.com/python/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "How do you print output in Python 3?", type: "option", options: ["echo()", "print()", "console.log()", "System.out.println()"], answer: "print()" },
          { question: "What keyword defines a function in Python?", type: "option", options: ["func", "define", "function", "def"], answer: "def" },
          { question: "Which data type is immutable in Python?", type: "option", options: ["List", "Dictionary", "Tuple", "Set"], answer: "Tuple" },
          { question: "How do you import a module named 'math'?", type: "option", options: ["include math", "require math", "import math", "using math"], answer: "import math" },
          { question: "Which data structure stores key-value pairs?", type: "option", options: ["List", "Tuple", "Dictionary", "Set"], answer: "Dictionary" },
          { question: "How do you write a comment in Python?", type: "option", options: ["// comment", "# comment", "/* comment */", "-- comment"], answer: "# comment" },
          { question: "What is the correct way to create a list in Python?", type: "option", options: ["list = (1, 2, 3)", "list = [1, 2, 3]", "list = {1, 2, 3}", "list = <1, 2, 3>"], answer: "list = [1, 2, 3]" },
          { question: "Which loop runs at least once in Python?", type: "option", options: ["for", "while", "do-while", "repeat"], answer: "while" },
          { question: "How do you find the length of a list?", type: "option", options: ["len(list)", "length(list)", "list.size()", "list.len()"], answer: "len(list)" },
          { question: "Which keyword is used to handle errors in Python?", type: "option", options: ["catch", "except", "error", "handle"], answer: "except" },
        ],
      },
      t("Weather CLI App", "Write a Python script that fetches weather from a free API and displays temperature and conditions.", ["https://openweathermap.org/api"], "Get a free API key from OpenWeatherMap."),
      t("File Organizer", "Write a Python script that sorts files into folders based on their file extension.", ["https://docs.python.org/3/library/os.html"], "Test on a copy of your files first."),
      t("Web Scraper", "Build a Python scraper using BeautifulSoup that extracts headlines from a website and saves them to a CSV file.", ["https://realpython.com/beautiful-soup-web-scraper-python/"], "Check robots.txt before scraping. Add a delay between requests."),
      t("Password Generator", "Create a Python program that generates random passwords with user-selected character types.", ["https://docs.python.org/3/library/secrets.html"], "Use the secrets module for better security."),
      t("To-Do List", "Build a command-line to-do list app that can add, list, and mark tasks as complete. Save tasks to a JSON file.", ["https://docs.python.org/3/library/json.html"], "Tasks should persist between runs using a JSON file."),
    ],
  },
  {
    id: "path_java", title: "Java Development", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Learn Java programming with strong OOP foundations, data structures, and real-world applications.",
    features: ["Java syntax & OOP", "Collections framework", "Exception handling", "File I/O & streams"],
    projects: [
      {
        title: "Java Programming Quiz",
        description: "Test your understanding of Java syntax, OOP concepts, and core libraries.",
        type: "quiz", links: [
          "https://docs.oracle.com/javase/tutorial/",
          "https://www.geeksforgeeks.org/java/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which keyword is used to inherit a class in Java?", type: "option", options: ["extends", "implements", "inherits", "super"], answer: "extends" },
          { question: "What is the entry point of a Java program?", type: "option", options: ["main()", "start()", "run()", "init()"], answer: "main()" },
          { question: "Which data type stores a single character?", type: "option", options: ["String", "char", "character", "text"], answer: "char" },
          { question: "What does JVM stand for?", type: "option", options: ["Java Virtual Machine", "Java Visual Module", "Java Variable Manager", "Java Version Model"], answer: "Java Virtual Machine" },
          { question: "Which method is called when an object is created?", type: "option", options: ["destructor", "constructor", "initializer", "builder"], answer: "constructor" },
          { question: "Which package is used for ArrayList in Java?", type: "option", options: ["java.util", "java.io", "java.lang", "java.collections"], answer: "java.util" },
          { question: "Which keyword is used to implement an interface?", type: "option", options: ["extends", "implements", "inherits", "using"], answer: "implements" },
          { question: "What is the size of int in Java?", type: "option", options: ["8 bits", "16 bits", "32 bits", "64 bits"], answer: "32 bits" },
          { question: "Which loop executes at least once in Java?", type: "option", options: ["for", "while", "do-while", "for-each"], answer: "do-while" },
          { question: "Which of these is NOT a Java primitive type?", type: "option", options: ["int", "float", "String", "boolean"], answer: "String" },
        ],
      },
      t("Student Records", "Create a Java program that stores student names and roll numbers, and can display all students.", ["https://docs.oracle.com/javase/tutorial/collections/"], "Use ArrayList to store students. Show a menu that keeps running until the user chooses to exit."),
      t("Library System", "Create a Java program that manages books in a library: add books, search by title, and list all books.", ["https://docs.oracle.com/javase/tutorial/essential/io/file.html"], "Save book data to a file so it persists between runs."),
      t("Bank Account", "Build a Java BankAccount class with deposit, withdraw, and balance check methods.", ["https://docs.oracle.com/javase/tutorial/java/IandI/"], "Create a simple console menu. Track a list of transactions."),
      t("Employee Manager", "Develop a Java program that manages employee records with add, list, and search by department.", ["https://docs.oracle.com/javase/tutorial/essential/io/file.html"], "Use HashMap to store employees with their ID as the key."),
      t("MCQ Quiz", "Create a Java console quiz that asks multiple-choice questions and shows the score at the end.", ["https://www.geeksforgeeks.org/java-swing-building-quiz-application/"], "Store questions in a list. Each question has 4 options and one correct answer."),
    ],
  },
  {
    id: "path_cpp", title: "C / C++ Development", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Build a strong foundation in C and C++ with memory management, OOP, and STL.",
    features: ["Pointers & memory management", "OOP in C++", "STL containers & algorithms", "File handling"],
    projects: [
      {
        title: "C/C++ Programming Quiz",
        description: "Test your knowledge of C and C++ concepts including pointers, OOP, and STL.",
        type: "quiz", links: [
          "https://en.cppreference.com/w/",
          "https://www.programiz.com/cpp-programming",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which header is needed for input/output in C++?", type: "option", options: ["<stdio.h>", "<iostream>", "<stdlib.h>", "<string.h>"], answer: "<iostream>" },
          { question: "What operator is used to access a pointer's value?", type: "option", options: ["&", "*", "->", "."], answer: "*" },
          { question: "What keyword allocates memory in C++?", type: "option", options: ["malloc", "alloc", "new", "create"], answer: "new" },
          { question: "Which access specifier makes members accessible only within the class?", type: "option", options: ["public", "protected", "private", "internal"], answer: "private" },
          { question: "What is the correct file extension for C++ source files?", type: "option", options: [".c", ".cpp", ".cs", ".ct"], answer: ".cpp" },
          { question: "Which operator is used to deallocate memory in C++?", type: "option", options: ["free", "delete", "release", "dealloc"], answer: "delete" },
          { question: "What is the correct way to define a class in C++?", type: "option", options: ["class MyClass {}", "MyClass class {}", "class MyClass[]", "class: MyClass"], answer: "class MyClass {}" },
          { question: "Which STL container stores unique elements in sorted order?", type: "option", options: ["vector", "list", "set", "map"], answer: "set" },
          { question: "What is the function to get the length of a string in C++?", type: "option", options: ["length()", "len()", "size()", "Both length() and size()"], answer: "Both length() and size()" },
          { question: "Which keyword is used to catch an exception in C++?", type: "option", options: ["catch", "except", "handle", "error"], answer: "catch" },
        ],
      },
      t("Library System", "Create a C++ program that manages books with add, list, and search features using classes.", ["https://en.cppreference.com/w/cpp/io"], "Use a vector to store books. Save data to a file."),
      t("Bank Account", "Build a C++ bank account program with deposit and withdraw methods using classes.", ["https://en.cppreference.com/w/cpp/language/virtual"], "Support both savings and current accounts."),
      t("Calendar App", "Write a C++ program that displays a calendar for any given month and year.", ["https://en.cppreference.com/w/cpp/chrono"], "Calculate the first day of the month to align days correctly."),
      t("Snake Game", "Implement the classic Snake game in C++ where the snake eats food and grows longer.", ["https://en.cppreference.com/w/cpp/io/c"], "Use keyboard controls (WASD). End the game if the snake hits a wall."),
      t("Sorting Visualizer", "Write a C++ program that shows how bubble sort works step by step with console output.", ["https://en.cppreference.com/w/cpp/algorithm"], "Use random numbers. Add a small delay between each pass."),
    ],
  },
  {
    id: "path_data_science", title: "Data Science", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Extract insights from data using statistical analysis, machine learning, and Python tools.",
    features: ["Python for data analysis", "Statistical modeling", "Machine learning", "Data visualization"],
    projects: [
      {
        title: "Data Science Quiz",
        description: "Test your knowledge of data science concepts, statistics, and machine learning fundamentals.",
        type: "quiz", links: [
          "https://scikit-learn.org/stable/tutorial/index.html",
          "https://www.kaggle.com/learn",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which Python library is primarily used for data manipulation?", type: "option", options: ["NumPy", "Pandas", "Matplotlib", "Scipy"], answer: "Pandas" },
          { question: "Which type of learning uses labeled data?", type: "option", options: ["Unsupervised", "Supervised", "Reinforcement", "Self-supervised"], answer: "Supervised" },
          { question: "What is the mean of the dataset [2, 4, 6, 8, 10]?", type: "option", options: ["4", "5", "6", "7"], answer: "6" },
          { question: "Which plot is best for showing data distribution?", type: "option", options: ["Bar chart", "Histogram", "Scatter plot", "Pie chart"], answer: "Histogram" },
          { question: "Which algorithm is used for regression?", type: "option", options: ["K-Means", "Linear Regression", "Decision Tree Classifier", "KNN Classifier"], answer: "Linear Regression" },
          { question: "Which library is used for plotting in Python?", type: "option", options: ["Pandas", "Matplotlib", "Scikit-learn", "NumPy"], answer: "Matplotlib" },
          { question: "What does CSV stand for?", type: "option", options: ["Comma Separated Values", "Common Style Values", "Computer Saved Variables", "Column Separated Values"], answer: "Comma Separated Values" },
          { question: "Which method splits data into training and testing sets?", type: "option", options: ["train_test_split", "split_data", "data_split", "cross_validate"], answer: "train_test_split" },
          { question: "What is the square root of variance?", type: "option", options: ["Mean", "Median", "Standard deviation", "Range"], answer: "Standard deviation" },
          { question: "Which type of data is categorical?", type: "option", options: ["Age", "Height", "Gender", "Temperature"], answer: "Gender" },
        ],
      },
      t("Sales Prediction", "Build a linear regression model in Python to predict sales from a CSV dataset.", ["https://scikit-learn.org/stable/modules/linear_model.html"], "Use any simple sales CSV. Show predicted vs actual values in a scatter plot."),
      t("Customer Segmentation", "Use K-Means clustering to group customers based on their purchase behavior.", ["https://scikit-learn.org/stable/modules/clustering.html"], "Standardize data first. Use the Elbow method to find the best K."),
      t("Sentiment Analysis", "Classify tweets or product reviews as positive or negative using a Naive Bayes classifier.", ["https://www.nltk.org/"], "Clean text by removing punctuation and stopwords. Evaluate with accuracy score."),
      t("Movie Recommendation", "Build a simple movie recommendation system using collaborative filtering or popularity.", ["https://scikit-learn.org/stable/modules/decomposition.html"], "Use the MovieLens small dataset. Recommend top 5 movies for a user."),
      t("Temperature Forecasting", "Analyze temperature data and predict future values using a moving average.", ["https://www.kaggle.com/learn/time-series"], "Plot historical data first. Predict the next 7 days."),
    ],
  },
  {
    id: "path_data_analysis", title: "Data Analysis", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Analyze datasets, create dashboards, and derive actionable insights using SQL and visualization tools.",
    features: ["SQL queries & joins", "Excel & spreadsheets", "Data cleaning & transformation", "Dashboard creation"],
    projects: [
      {
        title: "Data Analysis Quiz",
        description: "Test your understanding of SQL, data cleaning, and data visualization techniques.",
        type: "quiz", links: [
          "https://sqlbolt.com/",
          "https://www.datacamp.com/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which SQL clause filters rows based on a condition?", type: "option", options: ["WHERE", "HAVING", "FILTER", "MATCH"], answer: "WHERE" },
          { question: "What does SQL stand for?", type: "option", options: ["Structured Query Language", "Simple Query Language", "Standard Query Logic", "Sequential Query Language"], answer: "Structured Query Language" },
          { question: "Which join returns only matching rows from both tables?", type: "option", options: ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL OUTER JOIN"], answer: "INNER JOIN" },
          { question: "What function counts the number of rows in a group?", type: "option", options: ["SUM()", "COUNT()", "AVG()", "TOTAL()"], answer: "COUNT()" },
          { question: "Which SQL statement removes a table from the database?", type: "option", options: ["DELETE TABLE", "DROP TABLE", "REMOVE TABLE", "CLEAR TABLE"], answer: "DROP TABLE" },
          { question: "Which statement is used to select data from a table?", type: "option", options: ["GET", "SELECT", "FETCH", "RETRIEVE"], answer: "SELECT" },
          { question: "Which SQL statement is used to insert new data?", type: "option", options: ["INSERT INTO", "ADD INTO", "UPDATE", "CREATE"], answer: "INSERT INTO" },
          { question: "How do you sort results in descending order?", type: "option", options: ["ORDER BY DESC", "SORT BY DESC", "ORDER DESC", "SORT DESC"], answer: "ORDER BY DESC" },
          { question: "Which keyword eliminates duplicate rows?", type: "option", options: ["UNIQUE", "DISTINCT", "FILTER", "EXCEPT"], answer: "DISTINCT" },
          { question: "What is the primary key used for?", type: "option", options: ["Foreign key mapping", "Unique identifier for rows", "Indexing", "Sorting"], answer: "Unique identifier for rows" },
        ],
      },
      t("Sales Dashboard", "Analyze a sales CSV using Python Pandas. Calculate total revenue and top products, and create bar charts.", ["https://pandas.pydata.org/docs/"], "Clean missing values first. Group sales by month and product."),
      t("Customer Analysis", "Analyze customer purchase data using Pandas. Find the most valuable customers by how recently and how often they buy.", ["https://www.kaggle.com/learn/data-cleaning"], "Remove canceled orders. Group customers into segments."),
      t("Web Traffic Analysis", "Use SQL to analyze web traffic data. Find top pages, traffic sources, and daily visitors.", ["https://sqlbolt.com/"], "Use COUNT, SUM, and GROUP BY in your queries."),
      t("Employee Attrition", "Analyze employee data using Python. Find which factors are linked to employees leaving the company.", ["https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset"], "Use the IBM HR dataset. Compare attrition rates by department."),
      t("Inventory Analysis", "Analyze inventory data using Python. Find which items sell fast and which are slow-moving.", ["https://www.kaggle.com/learn/data-visualization"], "Merge product and inventory tables. Identify items not sold in 90 days."),
    ],
  },
  {
    id: "path_ml", title: "Machine Learning", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Build and deploy machine learning models using supervised and unsupervised learning techniques.",
    features: ["Supervised learning", "Unsupervised learning", "Model evaluation", "Feature engineering"],
    projects: [
      {
        title: "Machine Learning Quiz",
        description: "Test your understanding of ML algorithms, evaluation metrics, and model building concepts.",
        type: "quiz", links: [
          "https://scikit-learn.org/stable/supervised_learning.html",
          "https://www.kaggle.com/learn/machine-learning",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which algorithm is used for classification?", type: "option", options: ["Linear Regression", "Logistic Regression", "K-Means", "PCA"], answer: "Logistic Regression" },
          { question: "What does K-NN stand for?", type: "option", options: ["K-Nearest Nodes", "K-Nearest Neighbors", "Kernel Neural Network", "Knowledge Neural Net"], answer: "K-Nearest Neighbors" },
          { question: "Which type of learning groups unlabeled data?", type: "option", options: ["Supervised", "Unsupervised", "Reinforcement", "Semi-supervised"], answer: "Unsupervised" },
          { question: "Which ensemble method combines multiple decision trees?", type: "option", options: ["SVM", "Random Forest", "K-Means", "Naive Bayes"], answer: "Random Forest" },
          { question: "What does PCA do?", type: "option", options: ["Predicts values", "Reduces dimensionality", "Clusters data", "Classifies data"], answer: "Reduces dimensionality" },
          { question: "What does ML stand for?", type: "option", options: ["Machine Language", "Machine Learning", "Markup Language", "Memory Logic"], answer: "Machine Learning" },
          { question: "Which library is used for ML in Python?", type: "option", options: ["Pandas", "Matplotlib", "scikit-learn", "Flask"], answer: "scikit-learn" },
          { question: "What is overfitting?", type: "option", options: ["Model performs well on train but poorly on test", "Model performs poorly on train", "Model performs equally on train and test", "Model cannot learn"], answer: "Model performs well on train but poorly on test" },
          { question: "Which metric is used for classification?", type: "option", options: ["RMSE", "Accuracy", "MAE", "R-squared"], answer: "Accuracy" },
          { question: "What is a feature in ML?", type: "option", options: ["The target variable", "An input variable", "The model output", "The learning rate"], answer: "An input variable" },
        ],
      },
      t("Spam Classifier", "Train a Naive Bayes model to detect spam messages using text data.", ["https://scikit-learn.org/stable/tutorial/text_analytics/working_with_text_data.html"], "Convert text to TF-IDF features. Print accuracy and precision scores."),
      t("Image Classifier", "Train a neural network using TensorFlow/Keras to classify handwritten digits from MNIST.", ["https://www.tensorflow.org/tutorials/quickstart/beginner"], "Normalize pixel values. Train for a few epochs and check accuracy."),
      t("House Price Predictor", "Build a RandomForest model to predict house prices from a housing dataset.", ["https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestRegressor.html"], "Handle missing values. Try 100 trees and evaluate with RMSE."),
      t("Customer Churn", "Build a Logistic Regression model to predict which customers will leave.", ["https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html"], "Use the Telco dataset. Check accuracy and plot a confusion matrix."),
      t("Model API", "Deploy a trained ML model as a REST API using Flask with a /predict endpoint.", ["https://flask.palletsprojects.com/en/stable/"], "Save the model with joblib. Test with curl or Postman."),
    ],
  },
  {
    id: "path_ai", title: "Artificial Intelligence", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Explore AI concepts including search algorithms, neural networks, NLP, and intelligent agents.",
    features: ["Search & optimization", "Neural networks", "Natural language processing", "Reinforcement learning"],
    projects: [
      {
        title: "AI Fundamentals Quiz",
        description: "Test your knowledge of AI concepts, neural networks, NLP, and intelligent systems.",
        type: "quiz", links: [
          "https://www.tensorflow.org/learn",
          "https://paperswithcode.com/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which algorithm is used for pathfinding in AI?", type: "option", options: ["A*", "K-Means", "Linear Regression", "PCA"], answer: "A*" },
          { question: "What is a neural network activation function?", type: "option", options: ["Sigmoid", "SQL", "JSON", "HTTP"], answer: "Sigmoid" },
          { question: "Which NLP task determines the sentiment of text?", type: "option", options: ["Translation", "Sentiment analysis", "Summarization", "Tokenization"], answer: "Sentiment analysis" },
          { question: "Which network architecture is used for image recognition?", type: "option", options: ["RNN", "CNN", "GAN", "DBN"], answer: "CNN" },
          { question: "What does NLP stand for?", type: "option", options: ["Natural Language Processing", "Neural Language Programming", "Network Layer Protocol", "Non-Linear Processing"], answer: "Natural Language Processing" },
          { question: "What is the goal of AI?", type: "option", options: ["Create smart programs", "Make computers faster", "Store more data", "Design web pages"], answer: "Create smart programs" },
          { question: "Which of these is an AI application?", type: "option", options: ["Spreadsheet", "Self-driving car", "Text editor", "Web browser"], answer: "Self-driving car" },
          { question: "What is a neural network inspired by?", type: "option", options: ["The human brain", "The internet", "A computer CPU", "A database"], answer: "The human brain" },
          { question: "Which task does NLP NOT handle?", type: "option", options: ["Translation", "Sentiment analysis", "Image classification", "Text summarization"], answer: "Image classification" },
          { question: "What is a chatbot used for?", type: "option", options: ["Drawing images", "Having conversations with users", "Editing videos", "Managing files"], answer: "Having conversations with users" },
        ],
      },
      t("Simple Chatbot", "Build a rule-based chatbot in Python that responds to greetings and common questions.", ["https://realpython.com/python-chatbot/"], "Use if-elif conditions. Keep chatting until the user says goodbye."),
      t("Tic-Tac-Toe AI", "Implement Tic-Tac-Toe where the computer plays optimally using the Minimax algorithm.", ["https://www.geeksforgeeks.org/minimax-algorithm-in-game-theory/"], "Display the board as a 3x3 grid after each move."),
      t("Face Detector", "Write a Python script using OpenCV to detect faces in an image and draw rectangles around them.", ["https://docs.opencv.org/4.x/d0/d86/tutorial_py_face_detection.html"], "Use the pre-trained Haar Cascade model included with OpenCV."),
      t("Text Summarizer", "Create a simple text summarizer that picks the most important sentences from a paragraph.", ["https://www.nltk.org/book/ch03.html"], "Score sentences by word frequency. Return the top sentences as a summary."),
      t("Q&A Bot", "Build a tool that reads a document and answers simple questions by matching keywords.", ["https://huggingface.co/transformers/task_summary.html"], "Start with TF-IDF similarity. Test on a short text file."),
    ],
  },
  {
    id: "path_uiux", title: "UI/UX Design", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Design intuitive user interfaces and seamless user experiences using industry-standard tools.",
    features: ["Design principles & heuristics", "Wireframing & prototyping", "Visual design", "User research & testing"],
    projects: [
      {
        title: "UI/UX Design Quiz",
        description: "Test your understanding of design principles, usability, and UX research methods.",
        type: "quiz", links: [
          "https://www.figma.com/resource-library/",
          "https://www.nngroup.com/articles/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What does UX stand for?", type: "option", options: ["User Experience", "User Extension", "Unified Xperience", "Universal XML"], answer: "User Experience" },
          { question: "Which tool is commonly used for wireframing?", type: "option", options: ["Photoshop", "Figma", "VS Code", "Chrome"], answer: "Figma" },
          { question: "What is a low-fidelity prototype?", type: "option", options: ["Final polished design", "Basic sketch of layout", "Interactive animation", "Code implementation"], answer: "Basic sketch of layout" },
          { question: "Which color model is used for digital screens?", type: "option", options: ["CMYK", "RGB", "RYB", "HSL"], answer: "RGB" },
          { question: "What is an accessible design?", type: "option", options: ["Low-cost design", "Design usable by people with disabilities", "Fast-loading design", "Mobile-only design"], answer: "Design usable by people with disabilities" },
          { question: "What does UI stand for?", type: "option", options: ["User Interface", "Unified Input", "Universal Integration", "User Integration"], answer: "User Interface" },
          { question: "What is a wireframe?", type: "option", options: ["A basic layout sketch", "Final design", "A CSS file", "A code library"], answer: "A basic layout sketch" },
          { question: "Which principle means elements should look similar if they function similarly?", type: "option", options: ["Contrast", "Repetition", "Consistency", "Alignment"], answer: "Consistency" },
          { question: "What is a prototype?", type: "option", options: ["Final code", "Interactive mockup of a design", "A database", "A color palette"], answer: "Interactive mockup of a design" },
          { question: "What is white space in design?", type: "option", options: ["Empty space between elements", "Color white", "A CSS property", "Background image"], answer: "Empty space between elements" },
        ],
      },
      t("App Redesign", "Choose an app you use daily and redesign its home screen in Figma with better layout and colors.", ["https://www.figma.com/best-practices/"], "Create low-fi wireframes first, then a high-fi mockup."),
      t("Portfolio Design", "Design a single-page portfolio website in Figma with sections for your name, bio, skills, and projects.", ["https://www.figma.com/community"], "Design both mobile and desktop versions."),
      t("E-commerce Flow", "Design 3 screens for an e-commerce app in Figma: product list, product details, and checkout.", ["https://www.figma.com/templates/"], "Connect them with interactive prototyping."),
      t("Dashboard Design", "Create a data dashboard UI in Figma showing KPIs, a chart, and a data table.", ["https://dribbble.com/search/dashboard"], "Use placeholder data. Try a dark theme."),
      t("Design System", "Build a mini design system in Figma with colors, fonts, buttons, and input styles.", ["https://www.figma.com/plugin-docs/"], "Use Figma's Styles feature for colors and text."),
    ],
  },
  {
    id: "path_appdev", title: "App Development", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Develop cross-platform mobile applications using React Native and modern mobile development tools.",
    features: ["React Native basics", "Navigation & state management", "API integration", "App deployment"],
    projects: [
      {
        title: "App Development Quiz",
        description: "Test your knowledge of mobile app development, React Native, and cross-platform concepts.",
        type: "quiz", links: [
          "https://reactnative.dev/docs/getting-started",
          "https://docs.expo.dev/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which framework is used for cross-platform mobile apps?", type: "option", options: ["React Native", "React JS", "Node.js", "Express"], answer: "React Native" },
          { question: "What is the core component for displaying text in React Native?", type: "option", options: ["<div>", "<span>", "<Text>", "<Label>"], answer: "<Text>" },
          { question: "Which hook manages state in React?", type: "option", options: ["useEffect", "useState", "useReducer", "useMemo"], answer: "useState" },
          { question: "How do you style components in React Native?", type: "option", options: ["CSS files", "StyleSheet API", "Tailwind", "Bootstrap"], answer: "StyleSheet API" },
          { question: "What is an API?", type: "option", options: ["App Programming Interface", "Application Programming Interface", "Automated Program Integration", "Application Process Integration"], answer: "Application Programming Interface" },
          { question: "Which component is used for scrolling lists in React Native?", type: "option", options: ["ScrollView", "FlatList", "ListView", "List"], answer: "FlatList" },
          { question: "What is Expo used for?", type: "option", options: ["Building React Native apps easily", "Writing CSS", "Managing databases", "Creating APIs"], answer: "Building React Native apps easily" },
          { question: "Which navigation library is popular for React Native?", type: "option", options: ["React Navigation", "React Router", "Nav Router", "React Nav"], answer: "React Navigation" },
          { question: "What is a component in React Native?", type: "option", options: ["A reusable UI element", "A CSS file", "A database table", "An API endpoint"], answer: "A reusable UI element" },
          { question: "What does SDK stand for?", type: "option", options: ["Software Development Kit", "System Design Kit", "Standard Development Key", "Software Deployment Kit"], answer: "Software Development Kit" },
        ],
      },
      t("Task Manager", "Build a task manager app in React Native where users can add, complete, and delete tasks.", ["https://reactnative.dev/docs/tutorial"], "Use FlatList to display tasks. Save tasks with AsyncStorage."),
      t("Weather App", "Create a React Native app that shows weather for the user's current location using a free API.", ["https://reactnative.dev/docs/network"], "Request location permission. Show temperature and conditions."),
      t("Recipe Finder", "Build a recipe finder app that lets users search recipes by ingredients using a free API.", ["https://reactnative.dev/docs/flatlist"], "Display results as a list. Add a detail screen for each recipe."),
      t("Fitness Tracker", "Create a fitness tracker that logs workouts and shows today's stats and history.", ["https://reactnative.dev/docs/asyncstorage"], "Use a tab navigator for home and history screens."),
      t("Chat App", "Build a real-time chat app using Firebase with message list and send functionality.", ["https://rnfirebase.io/"], "Use Firebase Auth for login and Firestore for real-time messaging."),
    ],
  },
  {
    id: "path_cloud", title: "Cloud Computing", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Learn cloud infrastructure, containerization, and DevOps practices with major cloud providers.",
    features: ["AWS essentials", "Docker containers", "CI/CD pipelines", "Infrastructure as code"],
    projects: [
      {
        title: "Cloud Computing Quiz",
        description: "Test your understanding of cloud concepts, AWS services, and DevOps tools.",
        type: "quiz", links: [
          "https://aws.amazon.com/getting-started/",
          "https://docs.docker.com/get-started/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which cloud model provides virtual machines and storage?", type: "option", options: ["SaaS", "PaaS", "IaaS", "FaaS"], answer: "IaaS" },
          { question: "What is Docker used for?", type: "option", options: ["Database management", "Containerization", "Code editing", "Testing"], answer: "Containerization" },
          { question: "Which AWS service provides virtual servers?", type: "option", options: ["S3", "Lambda", "EC2", "RDS"], answer: "EC2" },
          { question: "What does CI/CD stand for?", type: "option", options: ["Continuous Integration / Continuous Deployment", "Code Integration / Code Deployment", "Continuous Improvement / Continuous Delivery", "Code Inspection / Code Debugging"], answer: "Continuous Integration / Continuous Deployment" },
          { question: "What does S3 stand for in AWS?", type: "option", options: ["Simple Storage Service", "System Storage Solution", "Secure Storage Service", "Standard Storage System"], answer: "Simple Storage Service" },
          { question: "What is cloud computing?", type: "option", options: ["Storing photos online", "Using remote servers over the internet", "Local data storage", "Installing software on your PC"], answer: "Using remote servers over the internet" },
          { question: "Which of these is a cloud provider?", type: "option", options: ["Adobe", "AWS", "Microsoft Word", "Photoshop"], answer: "AWS" },
          { question: "What does PaaS stand for?", type: "option", options: ["Platform as a Service", "Product as a Service", "Programming as a Service", "Processing as a Service"], answer: "Platform as a Service" },
          { question: "What is the benefit of cloud computing?", type: "option", options: ["Pay only for what you use", "Always free", "No internet needed", "Faster local storage"], answer: "Pay only for what you use" },
          { question: "What is a container?", type: "option", options: ["A physical box", "A lightweight virtual environment", "A database", "A programming language"], answer: "A lightweight virtual environment" },
        ],
      },
      t("Dockerize a Web App", "Write a Dockerfile for a simple Node.js or Python web app and run it in a container.", ["https://docs.docker.com/get-started/"], "Build the image and run it locally. Push to Docker Hub if you have an account."),
      t("Serverless Function", "Create an AWS Lambda function that returns a JSON response, triggered by API Gateway.", ["https://aws.amazon.com/lambda/getting-started/"], "Test the endpoint with a browser or curl."),
      t("Auto Scaling", "Launch an EC2 instance, create an AMI, and set up an auto-scaling group with a load balancer.", ["https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html"], "Use free tier t2.micro instances. Set min=1, max=2."),
      t("Monitoring Dashboard", "Set up Prometheus and Grafana using Docker Compose and create a CPU/memory dashboard.", ["https://prometheus.io/docs/introduction/overview/"], "Use the official Docker images. Import a pre-built dashboard."),
      t("S3 Backup Script", "Write a script that uploads a file to an AWS S3 bucket using boto3 or AWS CLI.", ["https://docs.aws.amazon.com/cli/latest/reference/s3/"], "Enable versioning on the bucket. Schedule with cron or Task Scheduler."),
    ],
  },
  {
    id: "path_cyber", title: "Cybersecurity", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Understand security principles, ethical hacking techniques, and network defense strategies.",
    features: ["Network security fundamentals", "Ethical hacking", "Cryptography", "Incident response"],
    projects: [
      {
        title: "Cybersecurity Quiz",
        description: "Test your knowledge of cybersecurity concepts, threats, and defense mechanisms.",
        type: "quiz", links: [
          "https://tryhackme.com/",
          "https://owasp.org/www-project-top-ten/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What is phishing?", type: "option", options: ["Network attack", "Social engineering via fake messages", "Physical security breach", "Database attack"], answer: "Social engineering via fake messages" },
          { question: "What does DDoS stand for?", type: "option", options: ["Distributed Denial of Service", "Data Destruction of System", "Dynamic Domain Security", "Direct Denial of Service"], answer: "Distributed Denial of Service" },
          { question: "What is a firewall used for?", type: "option", options: ["Speed up network", "Monitor and filter traffic", "Store passwords", "Encrypt data"], answer: "Monitor and filter traffic" },
          { question: "What does HTTPS stand for?", type: "option", options: ["HyperText Transfer Protocol Secure", "High Transfer Protocol Secure", "HyperText Transmission Protocol", "High Transfer Standard"], answer: "HyperText Transfer Protocol Secure" },
          { question: "What is multi-factor authentication?", type: "option", options: ["Multiple passwords", "Using 2+ verification methods", "Single sign-on", "Biometric only"], answer: "Using 2+ verification methods" },
          { question: "What is a virus in computing?", type: "option", options: ["A type of hardware", "Malicious software that spreads", "A programming language", "An operating system"], answer: "Malicious software that spreads" },
          { question: "What is encryption used for?", type: "option", options: ["Making data unreadable without a key", "Deleting data", "Copying data", "Speeding up a computer"], answer: "Making data unreadable without a key" },
          { question: "What is a strong password?", type: "option", options: ["Your name", "A short word", "A mix of letters, numbers, and symbols", "Your birthday"], answer: "A mix of letters, numbers, and symbols" },
          { question: "What is social engineering?", type: "option", options: ["Manipulating people to reveal info", "Building social networks", "Programming social media", "Engineering software"], answer: "Manipulating people to reveal info" },
          { question: "What should you do if you suspect a phishing email?", type: "option", options: ["Click the link to check", "Reply and ask", "Report it and delete it", "Forward to friends"], answer: "Report it and delete it" },
        ],
      },
      t("Security Audit", "Check a website's security headers and basic OWASP vulnerabilities. Write a short report.", ["https://owasp.org/www-project-web-security-testing-guide/"], "Use securityheaders.com. Test for basic XSS."),
      t("Penetration Testing Lab", "Set up Kali Linux in a VM and scan a target machine for open ports using Nmap.", ["https://www.kali.org/docs/"], "Use Metasploitable 2 as the target. Document findings."),
      t("Port Scanner", "Write a Python port scanner that checks common ports on a target IP address.", ["https://docs.python.org/3/library/socket.html"], "Scan ports 21, 22, 80, 443, 3306, 8080. Use threading."),
      t("Log Monitoring", "Set up Wazuh SIEM using Docker to monitor system logs and view alerts on a dashboard.", ["https://wazuh.com/get-started/"], "Test by generating failed login attempts."),
      t("Incident Response Plan", "Create a simple incident response plan for a small business with 6 phases.", ["https://www.nist.gov/cyberframework"], "Use the NIST framework. Include contact lists and playbooks."),
    ],
  },
  {
    id: "path_fullstack", title: "Full Stack Development", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Build complete web applications from frontend to backend with databases and deployment.",
    features: ["Frontend frameworks", "Backend APIs", "Database integration", "Deployment"],
    projects: [
      {
        title: "Full Stack Development Quiz",
        description: "Test your understanding of full stack development including frontend, backend, and databases.",
        type: "quiz", links: [
          "https://developer.mozilla.org/en-US/docs/Learn",
          "https://nodejs.org/en/docs/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What is a REST API?", type: "option", options: ["Architectural style for APIs", "Database type", "Frontend library", "CSS framework"], answer: "Architectural style for APIs" },
          { question: "Which backend runtime is built on Chrome's V8 engine?", type: "option", options: ["Python", "Node.js", "Java", "PHP"], answer: "Node.js" },
          { question: "What does CRUD stand for?", type: "option", options: ["Create, Read, Update, Delete", "Compile, Run, Update, Deploy", "Code, Review, Upload, Debug", "Connect, Request, Use, Disconnect"], answer: "Create, Read, Update, Delete" },
          { question: "Which HTTP method is used to update data?", type: "option", options: ["GET", "POST", "PUT", "DELETE"], answer: "PUT" },
          { question: "Which tool manages package dependencies in Node.js?", type: "option", options: ["npm", "pip", "gem", "cargo"], answer: "npm" },
          { question: "What is the frontend part of a web app?", type: "option", options: ["Server", "Database", "What users see and interact with", "API"], answer: "What users see and interact with" },
          { question: "What is the backend part of a web app?", type: "option", options: ["What users see", "Server-side logic and database", "CSS styles", "HTML structure"], answer: "Server-side logic and database" },
          { question: "Which HTTP method is used to get data?", type: "option", options: ["POST", "GET", "PUT", "DELETE"], answer: "GET" },
          { question: "What is a database used for?", type: "option", options: ["Storing data", "Displaying web pages", "Styling elements", "Handling user clicks"], answer: "Storing data" },
          { question: "What is MongoDB?", type: "option", options: ["A NoSQL database", "A CSS framework", "A JavaScript library", "A web server"], answer: "A NoSQL database" },
        ],
      },
      t("E-Commerce API", "Build a REST API with Node.js and Express that lets you create, read, update, and delete products.", ["https://expressjs.com/en/starter/hello-world.html"], "Start with in-memory storage. Test with Postman or curl."),
      t("Blog App", "Create a blog app with React frontend and Express backend where users can create and view posts.", ["https://react.dev/learn"], "Store posts in MongoDB. Style with basic CSS."),
      t("Social Media API", "Build a REST API for a social media platform with user registration, posts, and likes using Express and MongoDB.", ["https://expressjs.com/en/advanced/best-practice-security.html"], "Use JWT for authentication. Hash passwords with bcrypt."),
      t("Real-time Chat", "Build a real-time chat app using Socket.io where multiple users can send messages instantly.", ["https://socket.io/docs/v4/tutorial/introduction"], "Create a simple HTML/CSS frontend. Show who's online."),
      t("Task Board", "Build a Kanban board with React that has three columns: To Do, In Progress, and Done.", ["https://react.dev/learn"], "Allow drag-and-drop to move tasks between columns. Save to localStorage."),
    ],
  },
  {
    id: "path_devops", title: "DevOps Engineering", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Master DevOps practices including automation, monitoring, and cloud infrastructure management.",
    features: ["Version control & Git", "CI/CD pipelines", "Container orchestration", "Monitoring & logging"],
    projects: [
      {
        title: "DevOps Quiz",
        description: "Test your knowledge of DevOps tools, practices, and infrastructure automation.",
        type: "quiz", links: [
          "https://docs.github.com/en/actions",
          "https://kubernetes.io/docs/tutorials/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "Which tool is used for version control?", type: "option", options: ["Docker", "Git", "Jenkins", "Ansible"], answer: "Git" },
          { question: "What is a CI/CD pipeline?", type: "option", options: ["Automated build-test-deploy process", "Manual deployment", "Code review process", "Testing framework"], answer: "Automated build-test-deploy process" },
          { question: "Which tool is used for configuration management?", type: "option", options: ["Docker", "Kubernetes", "Ansible", "GitHub"], answer: "Ansible" },
          { question: "What is Terraform used for?", type: "option", options: ["Containerization", "Infrastructure as Code", "Monitoring", "Load testing"], answer: "Infrastructure as Code" },
          { question: "Which monitoring tool collects metrics and logs?", type: "option", options: ["Jenkins", "Prometheus", "Docker", "Git"], answer: "Prometheus" },
          { question: "What is DevOps a combination of?", type: "option", options: ["Development and Operations", "Design and Operations", "Development and Testing", "Deployment and Operations"], answer: "Development and Operations" },
          { question: "What is a GitHub Action?", type: "option", options: ["An automated workflow", "A social media post", "A code editor", "A database"], answer: "An automated workflow" },
          { question: "What is Kubernetes used for?", type: "option", options: ["Container orchestration", "Code editing", "Designing UI", "Writing documentation"], answer: "Container orchestration" },
          { question: "What is Infrastructure as Code?", type: "option", options: ["Managing infrastructure with code", "Writing application code", "Designing UI", "Testing software"], answer: "Managing infrastructure with code" },
          { question: "Which tool is used for logging and monitoring?", type: "option", options: ["Grafana", "Git", "Node.js", "React"], answer: "Grafana" },
        ],
      },
      t("GitHub Actions CI/CD", "Create a GitHub Actions workflow that installs dependencies and runs tests on every push.", ["https://docs.github.com/en/actions/learn-github-actions"], "Create the YAML file in .github/workflows/ci.yml."),
      t("Docker Compose", "Write a docker-compose.yml file that runs a Node.js app with a MongoDB database.", ["https://docs.docker.com/compose/gettingstarted/"], "Define services and volumes. Test by running docker-compose up."),
      t("Kubernetes Basics", "Install Minikube and deploy an Nginx pod. Expose it as a service and verify it works.", ["https://kubernetes.io/docs/tutorials/hello-minikube/"], "Use kubectl to inspect your pods and services."),
      t("Terraform Basics", "Write a Terraform config that creates an AWS S3 bucket. Run terraform apply to create it.", ["https://developer.hashicorp.com/terraform/tutorials/aws-get-started"], "Use terraform plan to review before applying. Destroy after testing."),
      t("Monitoring Stack", "Set up Prometheus and Grafana using Docker Compose and create a basic dashboard.", ["https://prometheus.io/docs/prometheus/latest/getting_started/"], "Configure Prometheus to scrape metrics from your machine."),
    ],
  },
  {
    id: "path_db", title: "Database Management", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Design, query, and manage relational and NoSQL databases for modern applications.",
    features: ["SQL fundamentals", "Database design & normalization", "Indexes & query optimization", "NoSQL databases"],
    projects: [
      {
        title: "Database Management Quiz",
        description: "Test your understanding of database design, SQL queries, and optimization techniques.",
        type: "quiz", links: [
          "https://www.postgresql.org/docs/current/tutorial.html",
          "https://sqlzoo.net/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What is a primary key?", type: "option", options: ["Unique identifier for a row", "Foreign reference", "Index type", "Constraint check"], answer: "Unique identifier for a row" },
          { question: "Which SQL statement creates a new table?", type: "option", options: ["CREATE TABLE", "MAKE TABLE", "NEW TABLE", "ADD TABLE"], answer: "CREATE TABLE" },
          { question: "What is database normalization?", type: "option", options: ["Organizing data to reduce redundancy", "Encrypting data", "Backing up data", "Indexing data"], answer: "Organizing data to reduce redundancy" },
          { question: "Which NoSQL database stores data as JSON-like documents?", type: "option", options: ["MySQL", "PostgreSQL", "MongoDB", "Redis"], answer: "MongoDB" },
          { question: "What is a JOIN in SQL?", type: "option", options: ["Combining rows from two tables", "Creating a backup", "Sorting data", "Filtering results"], answer: "Combining rows from two tables" },
          { question: "What is a foreign key?", type: "option", options: ["Links two tables together", "A primary key", "A unique constraint", "An index"], answer: "Links two tables together" },
          { question: "Which SQL keyword is used to filter groups?", type: "option", options: ["WHERE", "HAVING", "FILTER", "GROUP"], answer: "HAVING" },
          { question: "What does DBMS stand for?", type: "option", options: ["Database Management System", "Data Backup Management System", "Digital Base Management System", "Data Base Modeling System"], answer: "Database Management System" },
          { question: "Which of these is a relational database?", type: "option", options: ["MongoDB", "PostgreSQL", "Redis", "Cassandra"], answer: "PostgreSQL" },
          { question: "What is an index used for?", type: "option", options: ["Speeding up queries", "Deleting data", "Creating tables", "Backing up data"], answer: "Speeding up queries" },
        ],
      },
      t("E-Commerce Database", "Design a database schema for an e-commerce store with users, products, categories, and orders tables.", ["https://www.postgresql.org/docs/current/ddl.html"], "Write CREATE TABLE statements with primary and foreign keys. Insert sample data."),
      t("Library Database", "Create a PostgreSQL database for a library with books, members, and loans tables. Write queries to find overdue books.", ["https://www.postgresql.org/docs/current/queries.html"], "Use JOINs and aggregate functions like COUNT and SUM."),
      t("Query Optimization", "Create a table with many rows in PostgreSQL and compare query speed with and without an index.", ["https://www.postgresql.org/docs/current/indexes.html"], "Use EXPLAIN ANALYZE to see the difference."),
      t("MongoDB Data Modeling", "Design a MongoDB schema for a blog platform with posts and comments.", ["https://www.mongodb.com/docs/manual/data-modeling/"], "Create sample documents and write queries to find posts by user."),
      t("Sales Data Warehouse", "Design a star schema for sales data with fact and dimension tables in PostgreSQL.", ["https://www.postgresql.org/docs/current/datatype.html"], "Create a materialized view for monthly sales reporting."),
    ],
  },
  {
    id: "path_blockchain", title: "Blockchain Development", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Learn blockchain fundamentals, smart contracts, and decentralized application development.",
    features: ["Blockchain fundamentals", "Smart contracts", "Web3 & dApps", "Solidity programming"],
    projects: [
      {
        title: "Blockchain Quiz",
        description: "Test your knowledge of blockchain technology, smart contracts, and decentralized applications.",
        type: "quiz", links: [
          "https://ethereum.org/en/developers/docs/",
          "https://docs.soliditylang.org/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What is a blockchain?", type: "option", options: ["Distributed ledger", "Centralized database", "File storage", "Messaging protocol"], answer: "Distributed ledger" },
          { question: "Which language is used for Ethereum smart contracts?", type: "option", options: ["Python", "Solidity", "JavaScript", "Rust"], answer: "Solidity" },
          { question: "What is mining in blockchain?", type: "option", options: ["Extracting data", "Validating transactions and creating blocks", "Deleting blocks", "Encrypting data"], answer: "Validating transactions and creating blocks" },
          { question: "What does Web3 refer to?", type: "option", options: ["Third version of web", "Decentralized internet", "Faster internet", "Mobile web"], answer: "Decentralized internet" },
          { question: "What is a gas fee in Ethereum?", type: "option", options: ["Subscription fee", "Transaction processing fee", "Storage fee", "Registration fee"], answer: "Transaction processing fee" },
          { question: "What is a smart contract?", type: "option", options: ["A self-executing code on blockchain", "A legal document", "A database query", "A web page"], answer: "A self-executing code on blockchain" },
          { question: "What is a DApp?", type: "option", options: ["Decentralized Application", "Desktop Application", "Database App", "Dynamic App"], answer: "Decentralized Application" },
          { question: "What is a testnet used for?", type: "option", options: ["Testing blockchain apps without real money", "Real transactions", "Mining Bitcoin", "Storing data"], answer: "Testing blockchain apps without real money" },
          { question: "What is a wallet address in crypto?", type: "option", options: ["A physical wallet", "A unique identifier on the blockchain", "A password", "An email"], answer: "A unique identifier on the blockchain" },
          { question: "What is a consensus mechanism?", type: "option", options: ["How the network agrees on valid transactions", "A type of contract", "A programming language", "A web browser"], answer: "How the network agrees on valid transactions" },
        ],
      },
      t("Voting Contract", "Write a Solidity smart contract for a basic voting system that lets users vote for candidates.", ["https://docs.soliditylang.org/en/latest/introduction-to-smart-contracts.html"], "Use Remix IDE. Prevent double voting with a mapping."),
      t("ERC-20 Token", "Create and deploy an ERC-20 token using OpenZeppelin with mint and burn functionality.", ["https://docs.openzeppelin.com/contracts/4.x/erc20"], "Test with Hardhat on a local network first."),
      t("NFT Contract", "Write an ERC-721 NFT contract using OpenZeppelin with a max supply limit.", ["https://docs.openzeppelin.com/contracts/4.x/erc721"], "Deploy on Sepolia testnet. Use IPFS for metadata."),
      t("DeFi Basics", "Write a Solidity contract that accepts ETH deposits and allows users to withdraw their funds.", ["https://ethereum.org/en/developers/docs/defi/"], "Use a mapping to track balances. Emit events for deposits and withdrawals."),
      t("Multi-Sig Wallet", "Write a multi-signature wallet contract where multiple owners must approve a transaction.", ["https://ethereum.org/en/developers/docs/smart-contracts/"], "Require at least 2 of 3 owners to approve before executing."),
    ],
  },
  {
    id: "path_digital_marketing", title: "Digital Marketing", duration: "6 Weeks", paymentAmount: 0, paymentAmountReferral: 0,
    description: "Master digital marketing strategies including SEO, social media, content marketing, and analytics.",
    features: ["SEO & SEM", "Social media marketing", "Content strategy", "Analytics & reporting"],
    projects: [
      {
        title: "Digital Marketing Quiz",
        description: "Test your understanding of digital marketing channels, strategies, and analytics tools.",
        type: "quiz", links: [
          "https://moz.com/beginners-guide-to-seo",
          "https://analytics.google.com/analytics/academy/",
        ], passingGrade: 40,
        quizQuestions: [
          { question: "What does SEO stand for?", type: "option", options: ["Search Engine Optimization", "Social Engagement Optimization", "Systematic Engine Output", "Site Enhancement Operation"], answer: "Search Engine Optimization" },
          { question: "Which metric measures website traffic from search engines?", type: "option", options: ["Bounce rate", "Organic traffic", "Click-through rate", "Conversion rate"], answer: "Organic traffic" },
          { question: "What is a KPI in digital marketing?", type: "option", options: ["Key Performance Indicator", "Key Product Index", "Knowledge Processing Input", "Key Program Interface"], answer: "Key Performance Indicator" },
          { question: "Which platform is best for B2B marketing?", type: "option", options: ["Instagram", "LinkedIn", "TikTok", "Snapchat"], answer: "LinkedIn" },
          { question: "What is A/B testing?", type: "option", options: ["Comparing two versions of content", "Testing network speed", "Database testing", "Code testing"], answer: "Comparing two versions of content" },
          { question: "What is a conversion rate?", type: "option", options: ["Percentage of users who complete a goal", "Number of website visitors", "Time spent on site", "Pages per session"], answer: "Percentage of users who complete a goal" },
          { question: "What is a backlink in SEO?", type: "option", options: ["A link from another site to yours", "A link on your own site", "A broken link", "A paid link"], answer: "A link from another site to yours" },
          { question: "Which social media platform is best for visual content?", type: "option", options: ["LinkedIn", "Instagram", "Twitter", "Reddit"], answer: "Instagram" },
          { question: "What is bounce rate?", type: "option", options: ["Percentage of visitors who leave after one page", "Number of returning visitors", "Total visits", "Pages per session"], answer: "Percentage of visitors who leave after one page" },
          { question: "What is a call-to-action (CTA)?", type: "option", options: ["A prompt for the user to take action", "A phone call", "A type of ad", "An email"], answer: "A prompt for the user to take action" },
        ],
      },
      t("Marketing Campaign Plan", "Create a marketing campaign plan for a product with goals, target audience, channels, and a content calendar.", ["https://moz.com/learn/seo"], "Use SMART goals. Choose 3 marketing channels."),
      t("SEO Audit", "Perform an SEO audit of any website using free tools. Check meta tags, page speed, and mobile friendliness.", ["https://developers.google.com/search/docs/fundamentals/seo-starter-guide"], "Write a 1-page report with top 5 fixes."),
      t("Content Strategy", "Create a 30-day content marketing strategy for a brand with 3 content pillars and an editorial calendar.", ["https://ahrefs.com/blog/content-marketing/"], "Plan 10 posts mixing formats like blog, social media, and video."),
      t("Social Media Report", "Analyze a brand's social media performance by reviewing their last 10-15 posts and their engagement.", ["https://business.facebook.com/analytics"], "Calculate engagement rate. Recommend improvements."),
      t("Email Campaign", "Design a welcome email sequence of 3 emails using Mailchimp or SendGrid.", ["https://mailchimp.com/help/guides/"], "Write emails for Day 1, Day 3, and Day 5. Track open rates."),
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
