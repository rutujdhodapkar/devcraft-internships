import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "server", ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    const key = trimmed.slice(0, eqIdx).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const { CosmosClient } = await import("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DB_DATABASE || "devcraft");
const container = database.container(process.env.COSMOS_DB_CONTAINER || "main");

// ── Get all career paths ──
const { resources: allPaths } = await container.items
  .query({
    query: "SELECT * FROM c WHERE c.entityType = @type",
    parameters: [{ name: "@type", value: "careerPaths" }],
  })
  .fetchAll();

// ── Content blocks for each course ──

const courseContent = {
  "python-basics": {
    id: "python-basics",
    title: "Python Programming Basics",
    buttons: [
      { label: "Download Certificate", templateName: "Certificate", showWhen: "after" },
      { label: "Download Offer Letter", templateName: "Offer Letter", showWhen: "before" },
    ],
    content: [
      {
        title: "Welcome to Python",
        html: `<h2>Welcome to Python Programming</h2>
<p>Python is a powerful, easy-to-learn programming language used for web development, data science, AI, automation, and more. Created by Guido van Rossum in 1991, Python emphasizes readability and simplicity.</p>

<h3>Why Learn Python?</h3>
<ul>
<li><strong>Beginner-Friendly:</strong> Clean syntax reads like English</li>
<li><strong>Versatile:</strong> Web, desktop, data science, AI, automation</li>
<li><strong>Huge Community:</strong> Thousands of libraries and tutorials</li>
<li><strong>High Demand:</strong> One of the most sought-after skills</li>
</ul>

<h3>What You'll Learn in This Module</h3>
<ul>
<li>Installing Python and setting up your environment</li>
<li>Writing your first Python program</li>
<li>Variables, data types, and basic input/output</li>
</ul>

<h3>Installing Python</h3>
<ol>
<li>Go to <a href="https://python.org" target="_blank">python.org</a> and download the latest version</li>
<li>Run the installer (check "Add Python to PATH")</li>
<li>Open terminal/command prompt and type <code>python --version</code> to verify</li>
</ol>

<h3>Your First Program</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>print("Hello, World!")</code>
</pre>
<p>Save this as <code>hello.py</code> and run: <code>python hello.py</code></p>

<h3>Variables and Data Types</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># String
name = "Alice"

# Integer
age = 25

# Float
height = 5.6

# Boolean
is_student = True

# List
fruits = ["apple", "banana", "cherry"]

# Dictionary
person = {"name": "Alice", "age": 25}

print(f"My name is {name}, I am {age} years old")</code>
</pre>

<h3>Getting Input</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>name = input("Enter your name: ")
print(f"Hello, {name}!")</code>
</pre>

<p><em>Complete the quiz below to test your understanding, then mark this block as complete.</em></p>`,
        quiz: {
          title: "Module 1 Quiz",
          passingScore: 70,
          questions: [
            { question: "Who created Python?", options: ["Dennis Ritchie", "Guido van Rossum", "James Gosling", "Brendan Eich"], correctIndex: 1 },
            { question: "Which function prints output in Python?", options: ["echo()", "print()", "console.log()", "printf()"], correctIndex: 1 },
            { question: "Which data type is True/False?", options: ["int", "str", "bool", "float"], correctIndex: 2 },
            { question: "How do you create a variable x with value 5?", options: ["var x = 5", "x = 5", "int x = 5", "let x = 5"], correctIndex: 1 },
            { question: "What does the input() function do?", options: ["Prints text", "Reads user input", "Opens a file", "Imports a module"], correctIndex: 1 },
          ],
        },
      },
      {
        title: "Control Flow & Loops",
        html: `<h2>Control Flow & Loops</h2>
<p>Control flow statements let you make decisions and repeat actions in your code. They are fundamental to writing dynamic programs.</p>

<h3>If-Else Statements</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>age = 18

if age >= 18:
    print("You are an adult")
elif age >= 13:
    print("You are a teenager")
else:
    print("You are a child")</code>
</pre>

<h3>Comparison Operators</h3>
<table style="border-collapse:collapse;width:100%;margin:1rem 0;">
<tr><th style="border:1px solid #ccc;padding:0.5rem;background:#f0f0f0;">Operator</th><th style="border:1px solid #ccc;padding:0.5rem;background:#f0f0f0;">Meaning</th></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">==</td><td style="border:1px solid #ccc;padding:0.5rem;">Equal to</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">!=</td><td style="border:1px solid #ccc;padding:0.5rem;">Not equal</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&gt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Greater than</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Less than</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&gt;=</td><td style="border:1px solid #ccc;padding:0.5rem;">Greater or equal</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;=</td><td style="border:1px solid #ccc;padding:0.5rem;">Less or equal</td></tr>
</table>

<h3>For Loops</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Loop through a list
fruits = ["apple", "banana", "cherry"]
for fruit in fruits:
    print(f"I like {fruit}")

# Loop with range
for i in range(5):
    print(f"Count: {i}")

# Loop with index
for i, fruit in enumerate(fruits):
    print(f"{i+1}. {fruit}")</code>
</pre>

<h3>While Loops</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>count = 0
while count < 5:
    print(f"Count is {count}")
    count += 1

# Break and Continue
for i in range(10):
    if i == 3:
        continue  # Skip 3
    if i == 7:
        break     # Stop at 7
    print(i)</code>
</pre>

<h3>Logical Operators</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>age = 20
has_id = True

if age >= 18 and has_id:
    print("You can enter")

if not has_id:
    print("You need ID")

if age < 12 or age > 65:
    print("Discount applies")</code>
</pre>

<p><em>Complete the quiz, then mark this block as done.</em></p>`,
        quiz: {
          title: "Module 2 Quiz",
          passingScore: 70,
          questions: [
            { question: "Which keyword starts a conditional block?", options: ["for", "while", "if", "def"], correctIndex: 2 },
            { question: "How do you check if x equals 5?", options: ["x = 5", "x == 5", "x != 5", "x is 5"], correctIndex: 1 },
            { question: "Which loop runs while a condition is true?", options: ["for", "while", "do-while", "foreach"], correctIndex: 1 },
            { question: "What does range(5) generate?", options: ["0,1,2,3,4,5", "0,1,2,3,4", "1,2,3,4,5", "1,2,3,4"], correctIndex: 1 },
            { question: "What keyword exits a loop early?", options: ["stop", "exit", "break", "end"], correctIndex: 2 },
          ],
        },
      },
      {
        title: "Functions & Modules",
        html: `<h2>Functions & Modules</h2>
<p>Functions let you organize code into reusable blocks. Modules help you organize functions into separate files.</p>

<h3>Defining Functions</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>def greet(name):
    "This is a docstring - it explains what the function does"
    return f"Hello, {name}!"

# Call the function
message = greet("Alice")
print(message)  # Hello, Alice!</code>
</pre>

<h3>Function Parameters</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Default parameters
def power(base, exp=2):
    return base ** exp

print(power(3))    # 9
print(power(3, 3)) # 27

# Multiple returns
def min_max(numbers):
    return min(numbers), max(numbers)

low, high = min_max([3, 1, 7, 2, 9])
print(f"Low: {low}, High: {high}")</code>
</pre>

<h3>Variable Scope</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>x = 10  # Global variable

def my_func():
    x = 5  # Local variable - shadows global
    print(f"Inside: {x}")

my_func()  # Inside: 5
print(f"Outside: {x}")  # Outside: 10

# To modify global variable
def change_global():
    global x
    x = 20

change_global()
print(f"After global: {x}")  # 20</code>
</pre>

<h3>Importing Modules</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Import entire module
import math
print(math.sqrt(16))  # 4.0
print(math.pi)        # 3.14159...

# Import specific functions
from random import randint, choice
print(randint(1, 10))     # Random number 1-10
print(choice(["a","b","c"]))  # Random choice

# Import with alias
import datetime as dt
print(dt.datetime.now())</code>
</pre>

<h3>Lambda Functions</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Lambda = anonymous one-line function
square = lambda x: x ** 2
print(square(5))  # 25

# Used with map/filter
numbers = [1, 2, 3, 4, 5]
squared = list(map(lambda x: x**2, numbers))
evens = list(filter(lambda x: x % 2 == 0, numbers))
print(squared)  # [1, 4, 9, 16, 25]
print(evens)    # [2, 4]</code>
</pre>

<p><em>Quiz time! Test your knowledge of functions and modules.</em></p>`,
        quiz: {
          title: "Module 3 Quiz",
          passingScore: 70,
          questions: [
            { question: "Which keyword defines a function?", options: ["func", "define", "def", "function"], correctIndex: 2 },
            { question: "How do you return a value from a function?", options: ["return", "output", "yield", "send"], correctIndex: 0 },
            { question: "What is a lambda function?", options: ["A named function", "An anonymous one-line function", "A recursive function", "A built-in function"], correctIndex: 1 },
            { question: "Which module gives access to math functions?", options: ["sys", "os", "math", "random"], correctIndex: 2 },
            { question: "What keyword refers to a global variable inside a function?", options: ["global", "outer", "extern", "public"], correctIndex: 0 },
          ],
        },
      },
      {
        title: "File Handling & Data Structures",
        html: `<h2>File Handling & Data Structures</h2>
<p>Learn to work with files and advanced data structures like lists, dictionaries, sets, and tuples.</p>

<h3>Reading Files</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Read entire file
with open("notes.txt", "r") as file:
    content = file.read()
    print(content)

# Read line by line
with open("notes.txt", "r") as file:
    for line in file:
        print(line.strip())</code>
</pre>

<h3>Writing Files</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Write (overwrites)
with open("output.txt", "w") as file:
    file.write("Hello, File!")

# Append
with open("output.txt", "a") as file:
    file.write("\\nAnother line")

# Write multiple lines
lines = ["Line 1", "Line 2", "Line 3"]
with open("output.txt", "w") as file:
    file.writelines(line + "\\n" for line in lines)</code>
</pre>

<h3>Lists (Advanced)</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># List comprehension
squares = [x**2 for x in range(10)]
print(squares)  # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

# Filtering with comprehension
evens = [x for x in range(20) if x % 2 == 0]

# Sorting
numbers = [3, 1, 4, 1, 5, 9]
numbers.sort()
numbers.sort(reverse=True)
sorted_nums = sorted(numbers)

# List methods
fruits = ["apple", "banana"]
fruits.append("cherry")
fruits.insert(0, "avocado")
fruits.remove("banana")
popped = fruits.pop()</code>
</pre>

<h3>Dictionaries</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Dictionary comprehension
squares = {x: x**2 for x in range(5)}
print(squares)  # {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}

# Iterating
for key, value in squares.items():
    print(f"{key}: {value}")

# Get with default
count = squares.get(10, 0)  # Returns 0 if not found

# Merging dictionaries
a = {"x": 1, "y": 2}
b = {"y": 3, "z": 4}
merged = {**a, **b}  # Python 3.5+
# OR: merged = a | b  # Python 3.9+</code>
</pre>

<h3>Sets & Tuples</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Sets - unique items only
numbers = {1, 2, 2, 3, 3, 3}
print(numbers)  # {1, 2, 3}

# Set operations
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}
print(a | b)  # Union: {1,2,3,4,5,6}
print(a & b)  # Intersection: {3,4}
print(a - b)  # Difference: {1,2}

# Tuples - immutable
point = (3, 4)
x, y = point  # Unpacking
print(f"({x}, {y})")</code>
</pre>

<h3>Error Handling</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>try:
    number = int(input("Enter a number: "))
    result = 10 / number
    print(f"Result: {result}")
except ValueError:
    print("That's not a valid number!")
except ZeroDivisionError:
    print("Cannot divide by zero!")
else:
    print("No errors occurred!")
finally:
    print("This always runs")</code>
</pre>

<p><em>Take the final quiz to complete this module!</em></p>`,
        quiz: {
          title: "Module 4 Quiz",
          passingScore: 70,
          questions: [
            { question: "Which mode opens a file for writing?", options: ["r", "w", "a", "rw"], correctIndex: 1 },
            { question: "What does [x**2 for x in range(5)] produce?", options: ["List of squares of 0-4", "List of squares of 1-5", "Tuple of squares", "Set of squares"], correctIndex: 0 },
            { question: "Which data type stores unique items only?", options: ["List", "Tuple", "Set", "Dictionary"], correctIndex: 2 },
            { question: "How do you handle errors in Python?", options: ["try/except", "if/else", "for/while", "catch/throw"], correctIndex: 0 },
            { question: "What is the difference between a list and a tuple?", options: ["Lists are ordered, tuples are not", "Lists are mutable, tuples are immutable", "Tuples are faster", "No difference"], correctIndex: 1 },
          ],
        },
      },
    ],
  },

  "web-dev-fundamentals": {
    id: "web-dev-fundamentals",
    title: "Web Development Fundamentals",
    buttons: [
      { label: "Download Certificate", templateName: "Certificate", showWhen: "after" },
      { label: "Download Offer Letter", templateName: "Offer Letter", showWhen: "before" },
    ],
    content: [
      {
        title: "HTML Fundamentals",
        html: `<h2>HTML Fundamentals</h2>
<p>HTML (HyperText Markup Language) is the backbone of every website. It structures content using elements and tags.</p>

<h3>Basic HTML Structure</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;title&gt;My First Page&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;h1&gt;Hello, World!&lt;/h1&gt;
    &lt;p&gt;This is my first web page.&lt;/p&gt;
&lt;/body&gt;
&lt;/html&gt;</code>
</pre>

<h3>Common HTML Elements</h3>
<table style="border-collapse:collapse;width:100%;margin:1rem 0;">
<tr><th style="border:1px solid #ccc;padding:0.5rem;background:#f0f0f0;">Element</th><th style="border:1px solid #ccc;padding:0.5rem;background:#f0f0f0;">Purpose</th></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;h1&gt;-&lt;h6&gt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Headings (h1 = most important)</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;p&gt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Paragraph</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;a&gt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Link</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;img&gt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Image</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;ul&gt; / &lt;ol&gt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Unordered / Ordered list</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;div&gt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Generic container (block)</td></tr>
<tr><td style="border:1px solid #ccc;padding:0.5rem;">&lt;span&gt;</td><td style="border:1px solid #ccc;padding:0.5rem;">Generic container (inline)</td></tr>
</table>

<h3>Attributes</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>&lt;a href="https://example.com" target="_blank"&gt;Visit Example&lt;/a&gt;
&lt;img src="photo.jpg" alt="A beautiful photo" width="300"&gt;
&lt;input type="text" placeholder="Enter your name" required&gt;</code>
</pre>

<h3>Forms</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>&lt;form action="/submit" method="POST"&gt;
    &lt;label for="name"&gt;Name:&lt;/label&gt;
    &lt;input type="text" id="name" name="name" required&gt;
    
    &lt;label for="email"&gt;Email:&lt;/label&gt;
    &lt;input type="email" id="email" name="email"&gt;
    
    &lt;label for="message"&gt;Message:&lt;/label&gt;
    &lt;textarea id="message" name="message" rows="4"&gt;&lt;/textarea&gt;
    
    &lt;button type="submit"&gt;Send&lt;/button&gt;
&lt;/form&gt;</code>
</pre>

<h3>Semantic HTML</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>&lt;header&gt;Site header&lt;/header&gt;
&lt;nav&gt;Navigation links&lt;/nav&gt;
&lt;main&gt;
    &lt;article&gt;Main content&lt;/article&gt;
    &lt;aside&gt;Sidebar&lt;/aside&gt;
&lt;/main&gt;
&lt;footer&gt;Footer&lt;/footer&gt;</code>
</pre>

<p><em>Take the quiz to test your HTML knowledge!</em></p>`,
        quiz: {
          title: "HTML Quiz",
          passingScore: 70,
          questions: [
            { question: "What does HTML stand for?", options: ["HyperText Markup Language", "HighText Machine Language", "HyperTool Markup Language", "Home Tool Markup Language"], correctIndex: 0 },
            { question: "Which tag creates a paragraph?", options: ["&lt;para&gt;", "&lt;p&gt;", "&lt;text&gt;", "&lt;paragraph&gt;"], correctIndex: 1 },
            { question: "Which attribute sets the URL in a link?", options: ["src", "href", "url", "link"], correctIndex: 1 },
            { question: "Which tag is used for an image?", options: ["&lt;img&gt;", "&lt;image&gt;", "&lt;pic&gt;", "&lt;src&gt;"], correctIndex: 0 },
            { question: "What is semantic HTML?", options: ["HTML with CSS", "HTML using meaningful tags", "HTML with JavaScript", "HTML without attributes"], correctIndex: 1 },
          ],
        },
      },
      {
        title: "CSS Styling",
        html: `<h2>CSS Styling</h2>
<p>CSS (Cascading Style Sheets) controls the visual appearance of HTML elements — colors, layout, fonts, and animations.</p>

<h3>3 Ways to Add CSS</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>&lt;!-- 1. Inline --&gt;
&lt;p style="color: blue; font-size: 16px;"&gt;Blue text&lt;/p&gt;

&lt;!-- 2. Internal (in &lt;head&gt;) --&gt;
&lt;style&gt;
    p { color: blue; }
&lt;/style&gt;

&lt;!-- 3. External (best practice) --&gt;
&lt;link rel="stylesheet" href="styles.css"&gt;</code>
</pre>

<h3>CSS Selectors</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>/* Element selector */
h1 { color: navy; }

/* Class selector */
.highlight { background: yellow; }

/* ID selector */
#header { font-size: 2rem; }

/* Descendant selector */
article p { line-height: 1.6; }

/* Pseudo-class */
button:hover { background: darkblue; }

/* Multiple selectors */
h1, h2, h3 { font-family: Arial, sans-serif; }</code>
</pre>

<h3>Box Model</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>/* Every element is a box */
.box {
    width: 200px;
    height: 100px;
    padding: 20px;      /* Space INSIDE the box */
    border: 2px solid black;
    margin: 10px;        /* Space OUTSIDE the box */
    box-sizing: border-box;  /* Include padding in width */
}</code>
</pre>

<h3>Flexbox Layout</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>.container {
    display: flex;
    justify-content: center;  /* horizontal */
    align-items: center;      /* vertical */
    gap: 1rem;
    flex-wrap: wrap;
}

.item {
    flex: 1;                  /* grow equally */
    min-width: 200px;
}</code>
</pre>

<h3>CSS Grid</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>.grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
}

/* Responsive grid */
.responsive-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
}</code>
</pre>

<h3>Responsive Design</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>/* Mobile-first approach */
.container { padding: 1rem; }

@media (min-width: 768px) {
    .container { padding: 2rem; max-width: 720px; margin: auto; }
}

@media (min-width: 1024px) {
    .container { max-width: 960px; }
}</code>
</pre>

<p><em>Test your CSS skills with the quiz!</em></p>`,
        quiz: {
          title: "CSS Quiz",
          passingScore: 70,
          questions: [
            { question: "What does CSS stand for?", options: ["Cascading Style Sheets", "Computer Style Sheets", "Creative Style System", "Colorful Style Sheets"], correctIndex: 0 },
            { question: "Which CSS property changes text color?", options: ["font-color", "text-color", "color", "foreground"], correctIndex: 2 },
            { question: "What does padding control?", options: ["Space outside the border", "Space inside the border", "Border thickness", "Element width"], correctIndex: 1 },
            { question: "Which layout is best for 1D arrangements?", options: ["Grid", "Flexbox", "Float", "Table"], correctIndex: 1 },
            { question: "Which media feature checks screen width?", options: ["max-device", "min-width", "screen-size", "viewport"], correctIndex: 1 },
          ],
        },
      },
      {
        title: "JavaScript Basics",
        html: `<h2>JavaScript Basics</h2>
<p>JavaScript makes websites interactive. It runs in the browser and can respond to user actions, manipulate HTML, and communicate with servers.</p>

<h3>Variables</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Modern JavaScript uses let and const
let name = "Alice";      // Can be reassigned
const age = 25;          // Cannot be reassigned
var oldWay = "Avoid";    // Old way, avoid using

// Data types
let str = "Hello";
let num = 42;
let bool = true;
let arr = [1, 2, 3];
let obj = { key: "value" };</code>
</pre>

<h3>Functions</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Traditional function
function greet(name) {
    return "Hello, " + name;
}

// Arrow function (modern)
const greet = (name) => "Hello, " + name;

// Function with default params
const multiply = (a, b = 1) => a * b;</code>
</pre>

<h3>DOM Manipulation</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Selecting elements
const heading = document.querySelector("h1");
const allButtons = document.querySelectorAll("button");
const byId = document.getElementById("main");

// Modifying content
heading.textContent = "New Title";
heading.innerHTML = "&lt;em&gt;Italic Title&lt;/em&gt;";

// Changing styles
heading.style.color = "red";
heading.classList.add("active");
heading.classList.remove("hidden");

// Creating elements
const newPara = document.createElement("p");
newPara.textContent = "Hello!";
document.body.appendChild(newPara);</code>
</pre>

<h3>Events</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>const button = document.querySelector("#myButton");

button.addEventListener("click", () => {
    alert("Button clicked!");
});

// Common events: click, submit, mouseover, keydown, scroll
// Form submission
form.addEventListener("submit", (e) => {
    e.preventDefault();  // Stop page reload
    const data = new FormData(form);
    console.log(Object.fromEntries(data));
});</code>
</pre>

<h3>Async JavaScript</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Fetch API - get data from servers
fetch("https://api.example.com/data")
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error(error));

// Async/await (cleaner syntax)
async function getData() {
    try {
        const response = await fetch("https://api.example.com/data");
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error("Failed:", error);
    }
}</code>
</pre>

<p><em>Complete the quiz to test your JavaScript fundamentals!</em></p>`,
        quiz: {
          title: "JavaScript Quiz",
          passingScore: 70,
          questions: [
            { question: "Which keyword declares a constant variable?", options: ["var", "let", "const", "static"], correctIndex: 2 },
            { question: "How do you select an element by CSS selector?", options: ["getElementById", "querySelector", "getElementsByClass", "selectElement"], correctIndex: 1 },
            { question: "What does addEventListener do?", options: ["Adds HTML element", "Attaches event handler", "Creates animation", "Modifies style"], correctIndex: 1 },
            { question: "Which method makes an HTTP request?", options: ["fetch()", "request()", "http()", "get()"], correctIndex: 0 },
            { question: "What is the DOM?", options: ["A database", "Browser's representation of HTML", "A CSS framework", "JavaScript library"], correctIndex: 1 },
          ],
        },
      },
      {
        title: "Responsive Design & Project",
        html: `<h2>Responsive Design & Final Project</h2>
<p>Responsive design ensures your websites look great on all devices — phones, tablets, and desktops.</p>

<h3>Viewport Meta Tag</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>&lt;meta name="viewport" content="width=device-width, initial-scale=1.0"&gt;</code>
</pre>

<h3>Mobile-First Approach</h3>
<p>Start with styles for small screens, then add breakpoints for larger screens:</p>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>/* Base styles (mobile first) */
body { font-size: 16px; }
.sidebar { display: none; }

/* Tablet (768px+) */
@media (min-width: 768px) {
    .sidebar { display: block; }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
    .container { max-width: 960px; }
}</code>
</pre>

<h3>Responsive Images</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>img {
    max-width: 100%;
    height: auto;
}

/* Or use srcset for different sizes */
&lt;img src="small.jpg"
     srcset="medium.jpg 768w, large.jpg 1024w"
     sizes="(max-width: 768px) 100vw, 50vw"
     alt="Responsive image"&gt;</code>
</pre>

<h3>Accessibility Basics</h3>
<ul>
<li>Use semantic HTML (nav, main, article, aside)</li>
<li>Add alt text to all images</li>
<li>Use proper heading hierarchy (h1 → h2 → h3)</li>
<li>Ensure color contrast is sufficient</li>
<li>Make forms label all inputs</li>
<li>Support keyboard navigation (tabindex, focus styles)</li>
</ul>

<h3>Performance Tips</h3>
<ul>
<li>Minify CSS and JS</li>
<li>Optimize images (compress, use WebP)</li>
<li>Use lazy loading for images: <code>loading="lazy"</code></li>
<li>Reduce HTTP requests</li>
<li>Use browser caching</li>
<li>Consider using a CDN</li>
</ul>

<p><em>Now you're ready to build websites! Complete the quiz and move on to the projects.</em></p>`,
        quiz: {
          title: "Responsive Design Quiz",
          passingScore: 70,
          questions: [
            { question: "What meta tag enables responsive behavior?", options: ["&lt;meta responsive&gt;", "&lt;meta viewport&gt;", "&lt;meta mobile&gt;", "&lt;meta screen&gt;"], correctIndex: 1 },
            { question: "What does @media (min-width: 768px) target?", options: ["Screens smaller than 768px", "Screens 768px and wider", "Print only", "Mobile only"], correctIndex: 1 },
            { question: "How do you make images responsive?", options: ["width: 100%", "max-width: 100%", "height: auto", "Both max-width:100% and height:auto"], correctIndex: 3 },
            { question: "What is the mobile-first approach?", options: ["Start with desktop, then shrink", "Start with mobile styles, add larger breakpoints", "Build separate mobile site", "Use only mobile styles"], correctIndex: 1 },
            { question: "Why is alt text important?", options: ["For accessibility and SEO", "Makes images load faster", "Changes image color", "Adds animation"], correctIndex: 0 },
          ],
        },
      },
    ],
  },

  "react-modern-apps": {
    id: "react-modern-apps",
    title: "React & Modern Web Apps",
    buttons: [
      { label: "Download Certificate", templateName: "Certificate", showWhen: "after" },
      { label: "Download Offer Letter", templateName: "Offer Letter", showWhen: "before" },
    ],
    content: [
      {
        title: "React Fundamentals",
        html: `<h2>React Fundamentals</h2>
<p>React is a JavaScript library for building user interfaces. Created by Meta (Facebook), it lets you build reusable UI components.</p>

<h3>What is React?</h3>
<ul>
<li><strong>Component-Based:</strong> Build encapsulated components that manage their own state</li>
<li><strong>Declarative:</strong> Describe what you want, React handles the DOM updates</li>
<li><strong>Virtual DOM:</strong> Efficiently updates the real DOM by comparing changes</li>
<li><strong>Unidirectional Data Flow:</strong> Data flows down from parent to child via props</li>
</ul>

<h3>JSX - JavaScript XML</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// JSX looks like HTML but it's JavaScript
const element = &lt;h1&gt;Hello, World!&lt;/h1&gt;;

// Embed JavaScript expressions with {}
const name = "Alice";
const greeting = &lt;p&gt;Welcome, {name}!&lt;/p&gt;;

// JSX with multiple elements needs a wrapper
const component = (
    &lt;div&gt;
        &lt;h1&gt;Title&lt;/h1&gt;
        &lt;p&gt;Paragraph&lt;/p&gt;
    &lt;/div&gt;
);

// Or use Fragment to avoid extra divs
const fragment = (
    &lt;&gt;
        &lt;h1&gt;Title&lt;/h1&gt;
        &lt;p&gt;Paragraph&lt;/p&gt;
    &lt;/&gt;
);</code>
</pre>

<h3>Components</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Function component (modern)
function Greeting({ name }) {
    return &lt;h1&gt;Hello, {name}!&lt;/h1&gt;;
}

// Arrow function component
const Welcome = ({ name }) => (
    &lt;div&gt;
        &lt;h1&gt;Welcome, {name}&lt;/h1&gt;
        &lt;p&gt;Glad to see you!&lt;/p&gt;
    &lt;/div&gt;
);

// Using components
function App() {
    return (
        &lt;div&gt;
            &lt;Greeting name="Alice" /&gt;
            &lt;Welcome name="Bob" /&gt;
        &lt;/div&gt;
    );
}</code>
</pre>

<h3>Props</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Props = read-only data passed from parent
function UserCard({ name, age, isOnline }) {
    return (
        &lt;div className="card"&gt;
            &lt;h2&gt;{name}&lt;/h2&gt;
            &lt;p&gt;Age: {age}&lt;/p&gt;
            &lt;span style={{ color: isOnline ? 'green' : 'red' }}&gt;
                {isOnline ? 'Online' : 'Offline'}
            &lt;/span&gt;
        &lt;/div&gt;
    );
}

// Default props
function Button({ label = "Click", variant = "primary" }) {
    return &lt;button className={\`btn-\${variant}\`}&gt;{label}&lt;/button&gt;;
}</code>
</pre>

<h3>Creating a React App</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code># Using Vite (recommended)
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm run dev</code>
</pre>

<p><em>Take the quiz to test your React fundamentals!</em></p>`,
        quiz: {
          title: "React Fundamentals Quiz",
          passingScore: 70,
          questions: [
            { question: "What is React?", options: ["A CSS framework", "A JS library for building UIs", "A database", "A web server"], correctIndex: 1 },
            { question: "What is JSX?", options: ["A database query", "JavaScript XML syntax", "A CSS framework", "A server-side language"], correctIndex: 1 },
            { question: "How are components created in modern React?", options: ["Classes", "Functions", "Objects", "JSON"], correctIndex: 1 },
            { question: "How do you pass data to a child component?", options: ["Props", "State", "Hooks", "Classes"], correctIndex: 0 },
            { question: "What does the Virtual DOM do?", options: ["Creates databases", "Updates real DOM efficiently", "Manages routes", "Handles forms"], correctIndex: 1 },
          ],
        },
      },
      {
        title: "State & Hooks",
        html: `<h2>State & Hooks</h2>
<p>Hooks let you use state and other React features in function components. They were introduced in React 16.8.</p>

<h3>useState Hook</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>import { useState } from 'react';

function Counter() {
    const [count, setCount] = useState(0);

    return (
        &lt;div&gt;
            &lt;p&gt;Count: {count}&lt;/p&gt;
            &lt;button onClick={() => setCount(count + 1)}&gt;+&lt;/button&gt;
            &lt;button onClick={() => setCount(count - 1)}&gt;-&lt;/button&gt;
            &lt;button onClick={() => setCount(0)}&gt;Reset&lt;/button&gt;
        &lt;/div&gt;
    );
}

// State with objects
function Form() {
    const [form, setForm] = useState({ name: '', email: '' });

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    return (
        &lt;input
            value={form.name}
            onChange={e => updateField('name', e.target.value)}
        /&gt;
    );
}</code>
</pre>

<h3>useEffect Hook</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUser() {
            setLoading(true);
            try {
                const response = await fetch(\`/api/users/\${userId}\`);
                const data = await response.json();
                setUser(data);
            } catch (error) {
                console.error('Failed:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchUser();
    }, [userId]); // Re-run when userId changes

    if (loading) return &lt;p&gt;Loading...&lt;/p&gt;
    return &lt;h2&gt;{user?.name}&lt;/h2&gt;;
}</code>
</pre>

<h3>Common Hooks</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// useContext - share data without prop drilling
const ThemeContext = createContext('light');
const theme = useContext(ThemeContext);

// useRef - reference DOM elements
const inputRef = useRef(null);
inputRef.current.focus();

// useMemo - memoize expensive calculations
const sorted = useMemo(() => {
    return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// useCallback - memoize functions
const handleClick = useCallback(() => {
    doSomething(id);
}, [id]);</code>
</pre>

<h3>Custom Hooks</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Create reusable logic
function useLocalStorage(key, initialValue) {
    const [value, setValue] = useState(() => {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : initialValue;
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue];
}

// Usage
function App() {
    const [theme, setTheme] = useLocalStorage('theme', 'light');
    return &lt;div className={theme}&gt;...&lt;/div&gt;;
}</code>
</pre>

<p><em>Test your knowledge of hooks!</em></p>`,
        quiz: {
          title: "State & Hooks Quiz",
          passingScore: 70,
          questions: [
            { question: "Which hook manages state in a function component?", options: ["useEffect", "useState", "useReducer", "useMemo"], correctIndex: 1 },
            { question: "What does useEffect handle?", options: ["State updates", "Side effects", "Component styling", "Routing"], correctIndex: 1 },
            { question: "When does useEffect run by default?", options: ["Never", "After every render", "Only on first render", "On button click"], correctIndex: 1 },
            { question: "What is the dependency array for?", options: ["Control when effect re-runs", "Store state values", "Define props", "Style components"], correctIndex: 0 },
            { question: "Which hook references DOM elements?", options: ["useRef", "useState", "useEffect", "useContext"], correctIndex: 0 },
          ],
        },
      },
      {
        title: "Component Patterns",
        html: `<h2>Component Patterns & Best Practices</h2>
<p>Learn how to structure React applications for maintainability and performance.</p>

<h3>Component Composition</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Container/Presentational pattern
function UserList() {      // Container - manages state
    const [users, setUsers] = useState([]);
    useEffect(() => { fetchUsers().then(setUsers); }, []);
    return &lt;UserListUI users={users} /&gt;;
}

function UserListUI({ users }) {  // Presentational - renders UI
    return (
        &lt;ul&gt;
            {users.map(u => &lt;li key={u.id}&gt;{u.name}&lt;/li&gt;)}
        &lt;/ul&gt;
    );
}</code>
</pre>

<h3>Conditional Rendering</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>function Profile({ user }) {
    if (!user) return &lt;LoginPrompt /&gt;;
    if (user.banned) return &lt;AccessDenied /&gt;;
    
    return (
        &lt;div&gt;
            &lt;h2&gt;{user.name}&lt;/h2&gt;
            {user.isAdmin && &lt;AdminPanel /&gt;}
            {user.premium 
                ? &lt;PremiumContent /&gt;
                : &lt;UpgradePrompt /&gt;
            }
        &lt;/div&gt;
    );
}</code>
</pre>

<h3>Lists & Keys</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>function TodoList({ items }) {
    return (
        &lt;ul&gt;
            {items.map(item => (
                &lt;li key={item.id}&gt;  {/* Always use stable keys */}
                    &lt;span style={{
                        textDecoration: item.done ? 'line-through' : 'none'
                    }}&gt;
                        {item.text}
                    &lt;/span&gt;
                    &lt;button onClick={() => toggle(item.id)}&gt;
                        {item.done ? 'Undo' : 'Done'}
                    &lt;/button&gt;
                &lt;/li&gt;
            ))}
        &lt;/ul&gt;
    );
}</code>
</pre>

<h3>Lifting State Up</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>function App() {
    const [temperature, setTemperature] = useState(20);

    return (
        &lt;div&gt;
            &lt;Thermometer value={temperature} /&gt;
            &lt;Controls
                value={temperature}
                onChange={setTemperature}
            /&gt;
        &lt;/div&gt;
    );
}

function Controls({ value, onChange }) {
    return &lt;input type="range" value={value}
        onChange={e => onChange(+e.target.value)} /&gt;;
}</code>
</pre>

<h3>Error Boundaries</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>// Wrap unstable components
&lt;ErrorBoundary fallback={&lt;ErrorUI /&gt;}&gt;
    &lt;DataFetcher /&gt;
&lt;/ErrorBoundary&gt;</code>
</pre>

<p><em>Complete the quiz!</em></p>`,
        quiz: {
          title: "Component Patterns Quiz",
          passingScore: 70,
          questions: [
            { question: "What is the key prop used for in lists?", options: ["Styling", "Uniquely identifying items", "Sorting", "Filtering"], correctIndex: 1 },
            { question: "What pattern separates state logic from UI?", options: ["Container/Presentational", "HOC", "Render Props", "Custom Hooks"], correctIndex: 0 },
            { question: "How do you conditionally render a component?", options: ["Using if/else in JSX", "Using && or ternary", "Using switch", "All of the above"], correctIndex: 3 },
            { question: "What does 'lifting state up' mean?", options: ["Moving state to a parent component", "Using global variables", "Deleting state", "Copying state"], correctIndex: 0 },
            { question: "What is a Fragment used for?", options: ["Grouping elements without extra DOM node", "Creating animations", "Managing state", "Handling forms"], correctIndex: 0 },
          ],
        },
      },
      {
        title: "Routing & APIs",
        html: `<h2>Routing & API Integration</h2>
<p>Learn to add navigation with React Router and connect to backend APIs.</p>

<h3>React Router Setup</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>npm install react-router-dom</code>
</pre>

<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function App() {
    return (
        &lt;BrowserRouter&gt;
            &lt;nav&gt;
                &lt;Link to="/"&gt;Home&lt;/Link&gt;
                &lt;Link to="/about"&gt;About&lt;/Link&gt;
                &lt;Link to="/users"&gt;Users&lt;/Link&gt;
            &lt;/nav&gt;
            &lt;Routes&gt;
                &lt;Route path="/" element={&lt;Home /&gt;} /&gt;
                &lt;Route path="/about" element={&lt;About /&gt;} /&gt;
                &lt;Route path="/users/:id" element={&lt;UserProfile /&gt;} /&gt;
                &lt;Route path="*" element={&lt;NotFound /&gt;} /&gt;
            &lt;/Routes&gt;
        &lt;/BrowserRouter&gt;
    );
}

// Dynamic routes
function UserProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    return (
        &lt;div&gt;
            &lt;h1&gt;User {id}&lt;/h1&gt;
            &lt;button onClick={() => navigate(-1)}&gt;Back&lt;/button&gt;
        &lt;/div&gt;
    );
}</code>
</pre>

<h3>API Integration with Axios</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>npm install axios</code>
</pre>

<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>import axios from 'axios';

const api = axios.create({
    baseURL: 'https://api.example.com',
    timeout: 5000,
    headers: { 'Content-Type': 'application/json' },
});

// Interceptors
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = \`Bearer \${token}\`;
    return config;
});

// Usage
async function fetchProducts() {
    try {
        const { data } = await api.get('/products');
        return data;
    } catch (error) {
        console.error('API Error:', error.response?.data);
        throw error;
    }
}</code>
</pre>

<h3>Custom Fetch Hook</h3>
<pre style="background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto;">
<code>function useFetch(url) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(data => {
                if (!cancelled) { setData(data); setError(null); }
            })
            .catch(err => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [url]);

    return { data, loading, error };
}</code>
</pre>

<p><em>Complete the quiz!</em></p>`,
        quiz: {
          title: "Routing & APIs Quiz",
          passingScore: 70,
          questions: [
            { question: "Which hook gets URL parameters in React Router?", options: ["useParams", "useNavigate", "useLocation", "useRoute"], correctIndex: 0 },
            { question: "What does &lt;Link&gt; do?", options: ["Fetches data", "Navigates without page reload", "Styles elements", "Creates forms"], correctIndex: 1 },
            { question: "Which HTTP library is popular for React?", options: ["jQuery", "Axios", "Moment", "Lodash"], correctIndex: 1 },
            { question: "How do you handle 404 routes?", options: ["Catch-all route with *", "Error boundary", "Redirect", "404 component"], correctIndex: 0 },
            { question: "What is a route parameter?", options: ["Query string", "URL path segment like :id", "Header value", "Cookie"], correctIndex: 1 },
          ],
        },
      },
    ],
  },
};

// ── Update courses in DB ──

for (const [courseId, courseData] of Object.entries(courseContent)) {
  const existing = allPaths.find(p => p.id === courseId);
  if (!existing) {
    console.log(`Course ${courseId} not found, skipping`);
    continue;
  }

  // Add content blocks and buttons
  existing.content = courseData.content;
  existing.buttons = courseData.buttons;

  // Ensure payment amounts (free courses)
  existing.price = 0;
  
  await container.items.upsert(existing);
  console.log(`✓ ${courseData.title}: added ${courseData.content.length} modules + certificate buttons`);
}

// ── Also update bundle ──
console.log("\nUpdating bundle...");
const { resources: bundles } = await container.items.query({
  query: "SELECT * FROM c WHERE c.entityType = @type AND c.id = @id",
  parameters: [{ name: "@type", value: "siteConfig" }, { name: "@id", value: "careerPaths" }],
}).fetchAll();

if (bundles.length) {
  const bundle = bundles[0];
  const list = bundle.value?.list || [];
  for (const [courseId, courseData] of Object.entries(courseContent)) {
    const idx = list.findIndex(p => p.id === courseId);
    if (idx >= 0) {
      list[idx].content = courseData.content;
      list[idx].buttons = courseData.buttons;
      list[idx].price = 0;
    }
  }
  bundle.value.list = list;
  bundle.updatedAt = new Date().toISOString();
  await container.items.upsert(bundle);
  console.log("✓ Bundle updated with course content");
}

// ── Bump version ──
try {
  const { resources: vDoc } = await container.items.query({
    query: "SELECT * FROM c WHERE c.entityType = @type AND c.id = @id",
    parameters: [{ name: "@type", value: "siteConfig" }, { name: "@id", value: "configVersions" }],
  }).fetchAll();
  const version = Math.floor(Date.now() / 86400000).toString(36);
  if (vDoc.length) {
    vDoc[0].value.careerPaths = version;
    vDoc[0].updatedAt = new Date().toISOString();
    await container.items.upsert(vDoc[0]);
  }
  console.log("✓ Version bumped");
} catch (e) {
  console.log("⚠ Version bump failed:", e.message);
}

console.log("\n✅ All courses updated! Courses now have:");
console.log("  • HTML content blocks with tutorials and code examples");
console.log("  • Quizzes at end of each module");
console.log("  • Projects/assignments for hands-on practice");
console.log("  • Certificate download buttons on completion");
