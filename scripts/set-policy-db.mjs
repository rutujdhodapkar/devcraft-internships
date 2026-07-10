import { initCosmosDb } from "../server/cosmos.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

const envContent = readFileSync(resolve(__dirname, "../server/.env"), "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^\s*(\w+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const db = await initCosmosDb();
if (!db) { console.log("Failed to connect"); process.exit(1); }

const termsHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DevCraft - Terms and Conditions</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial, Helvetica, sans-serif;background:#ffffff;color:#222;line-height:1.7;}
.container{max-width:1000px;margin:auto;padding:50px 25px;}
h1{font-size:34px;margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:12px;}
h2{font-size:22px;margin-top:35px;margin-bottom:15px;}
p{margin-bottom:15px;}
ul{margin-left:25px;margin-bottom:15px;}
li{margin-bottom:8px;}
.notice{background:#f5f5f5;border-left:5px solid #000;padding:18px;margin:25px 0;}
footer{border-top:1px solid #ddd;padding-top:30px;color:#666;font-size:14px;text-align:center;margin-top:60px;}
a{color:#000;}
</style>
</head>
<body>
<div class="container">

<h1>Terms and Conditions</h1>
<p><strong>Last Updated:</strong> July 6, 2026</p>

<p>Welcome to DevCraft. By accessing or using our website, services, internships, certificates, or programs, you agree to these Terms and Conditions.</p>

<h2>1. Nature of Service</h2>
<p>DevCraft is an independent educational and skill-development platform.</p>
<div class="notice">
DevCraft is NOT a registered company, corporation, university, government organization, recruitment agency, or accredited educational institution.
</div>

<h2>2. Eligibility</h2>
<ul>
<li>You must be at least 16 years of age to use our services, or have consent from a parent/legal guardian.</li>
<li>By registering, you represent that all information provided is accurate and current.</li>
</ul>

<h2>3. No Employment Guarantee</h2>
<p>Participation in any program, internship, or activity on DevCraft does not create an employment relationship between the participant and DevCraft.</p>
<ul>
<li>No job guarantee.</li>
<li>No placement guarantee.</li>
<li>No promise of future employment opportunities.</li>
<li>No guarantee of internships with third-party companies.</li>
</ul>

<h2>4. Certificate Disclaimer</h2>
<p>Certificates issued by DevCraft are participation and completion certificates only.</p>
<ul>
<li>We do not guarantee that our certificates will be accepted by employers, universities, or institutions.</li>
<li>We do not guarantee that our certificates hold industry-recognized value.</li>
<li>We do not guarantee academic credits or accreditation.</li>
<li>Acceptance of certificates is solely at the discretion of the receiving organization.</li>
</ul>

<h2>5. Tasks and Projects Disclaimer</h2>
<p>Assignments, projects, and activities are intended for educational and skill-development purposes only.</p>
<ul>
<li>We do not commit to providing industry-level tasks.</li>
<li>We do not guarantee real-world company projects.</li>
<li>We do not guarantee production-grade experience.</li>
<li>We do not guarantee commercial project exposure.</li>
</ul>

<h2>6. Intellectual Property</h2>
<ul>
<li>All content on DevCraft — curriculum, templates, branding, code, and materials — is owned by DevCraft or its licensors, unless stated otherwise.</li>
<li>Participants retain ownership of original work they submit, but grant DevCraft a non-exclusive license to use submitted work for evaluation, showcasing, and internal quality purposes.</li>
<li>You may not copy, redistribute, or resell DevCraft's proprietary materials without written consent.</li>
</ul>

<h2>7. User Responsibilities</h2>
<ul>
<li>Provide accurate information.</li>
<li>Do not impersonate another person.</li>
<li>Do not misuse the platform.</li>
<li>Do not submit forged documents or certificates.</li>
<li>Comply with all applicable laws.</li>
</ul>

<h2>8. Payments</h2>
<p>Certain services on DevCraft may require payment. By making a payment, you agree to the pricing displayed at the time of purchase.</p>

<h2>8.1 Fees and Charges</h2>
<p>Any fees charged by DevCraft are solely for educational services, platform maintenance, administration, certificate generation, mentorship, and operational expenses.</p>
<p>Payment of any fee does not guarantee:</p>
<ul>
<li>Employment opportunities.</li>
<li>Job placement.</li>
<li>Industry-recognized certification.</li>
<li>Acceptance of certificates by employers or institutions.</li>
<li>Internships with third-party companies.</li>
</ul>
<p>By making a payment, the user acknowledges that the fee is paid solely for participation in educational and skill-development activities.</p>

<h2>9. Third-Party Links and Services</h2>
<p>Our platform may contain links to third-party websites or services (e.g., payment gateways, hosting providers). DevCraft is not responsible for the content, policies, or practices of any third-party service.</p>

<h2>10. Limitation of Liability</h2>
<p>DevCraft shall not be liable for:</p>
<ul>
<li>Career outcomes.</li>
<li>Employment opportunities.</li>
<li>Certificate acceptance or rejection.</li>
<li>Financial losses.</li>
<li>Any indirect or consequential damages arising from the use of our services.</li>
</ul>

<h2>11. Indemnification</h2>
<p>You agree to indemnify and hold DevCraft, its founders, and affiliates harmless from any claims, damages, liabilities, and expenses (including legal fees) arising from your use of the platform, violation of these Terms, or infringement of any third-party rights.</p>

<h2>12. Force Majeure</h2>
<p>DevCraft shall not be held liable for any failure or delay in performance caused by circumstances beyond its reasonable control, including but not limited to natural disasters, internet or server outages, government action, or other events of force majeure.</p>

<h2>13. Service Changes</h2>
<p>We reserve the right to modify, suspend, or discontinue any service at any time without prior notice.</p>

<h2>14. Termination</h2>
<p>We reserve the right to suspend or terminate access to our platform if a user violates these Terms and Conditions.</p>

<h2>15. Dispute Resolution</h2>
<p>Any disputes arising from these Terms shall first be attempted to be resolved amicably. Failing that, disputes shall be subject to the exclusive jurisdiction of the courts at Pune, Maharashtra, India.</p>

<h2>16. Governing Law</h2>
<p>These Terms and Conditions shall be governed and interpreted in accordance with the laws of India.</p>

<h2>17. Grievance Officer</h2>
<p>In accordance with applicable Indian IT rules, for any grievances or concerns regarding this platform, you may contact our Grievance Officer:</p>
<p>Name: Rutuj Dhodapkar<br>
Email: rutujdhodapkar@gmail.com</p>

<h2>18. Contact Information</h2>
<p>Email: rutujdhodapkar@gmail.com<br>
Website: https://devcraft.fennark.xyz</p>

<footer>
DevCraft is an independent educational and skill-development platform and is not a registered company, university, government organization, or accredited certification body. Certificates are issued solely for participation and educational purposes. No employment, placement, internship, or certificate acceptance is guaranteed.
<br><br>
© 2026 DevCraft. All Rights Reserved.
</footer>

</div>
</body>
</html>`;

const privacyHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DevCraft - Privacy Policy</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial, Helvetica, sans-serif;background:#ffffff;color:#222;line-height:1.7;}
.container{max-width:1000px;margin:auto;padding:50px 25px;}
h1{font-size:34px;margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:12px;}
h2{font-size:22px;margin-top:35px;margin-bottom:15px;}
p{margin-bottom:15px;}
ul{margin-left:25px;margin-bottom:15px;}
li{margin-bottom:8px;}
.notice{background:#f5f5f5;border-left:5px solid #000;padding:18px;margin:25px 0;}
footer{border-top:1px solid #ddd;padding-top:30px;color:#666;font-size:14px;text-align:center;margin-top:60px;}
a{color:#000;}
</style>
</head>
<body>
<div class="container">

<h1>Privacy Policy</h1>
<p><strong>Last Updated:</strong> July 6, 2026</p>

<p>This Privacy Policy explains how DevCraft collects, uses, stores, and protects your personal information when you use our platform.</p>

<h2>1. Information We Collect</h2>
<ul>
<li>Name</li>
<li>Email Address</li>
<li>Phone Number</li>
<li>Payment Information</li>
<li>Assignment Submissions</li>
<li>Usage Analytics (device, browser, IP address, pages visited)</li>
<li>Cookies and similar tracking technologies</li>
</ul>

<h2>2. How We Use Information</h2>
<ul>
<li>Provide and improve services.</li>
<li>Generate certificates.</li>
<li>Process payments.</li>
<li>Communicate with users.</li>
<li>Maintain platform security.</li>
<li>Analyze usage trends to improve curriculum and platform performance.</li>
</ul>

<h2>3. Cookies Policy</h2>
<p>DevCraft uses cookies and similar technologies to improve user experience, remember preferences, and analyze traffic. You can disable cookies through your browser settings, though this may limit platform functionality.</p>

<h2>4. Data Sharing</h2>
<p>We do not sell personal information to third parties. Information may be shared with:</p>
<ul>
<li>Payment processors (for transaction handling).</li>
<li>Service providers assisting in platform operations (e.g., hosting, analytics).</li>
<li>Government or legal authorities when required by law.</li>
</ul>

<h2>5. Data Retention</h2>
<p>We retain personal information for as long as necessary to fulfill the purposes outlined in this policy, comply with legal obligations, or resolve disputes. Users may request earlier deletion subject to legal and operational constraints.</p>

<h2>6. Data Security</h2>
<p>We take reasonable technical and organizational measures to protect user information, but no method of electronic transmission or storage is completely secure. Use of the platform is at your own risk.</p>

<h2>7. Children's Privacy</h2>
<p>DevCraft is not intended for individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware of such data being collected, we will delete it promptly.</p>

<h2>8. Your Rights</h2>
<p>Subject to applicable data protection laws (including India's Digital Personal Data Protection Act, 2023), you may:</p>
<ul>
<li>Request access to the personal data we hold about you.</li>
<li>Request correction of inaccurate or incomplete data.</li>
<li>Request deletion of your personal data.</li>
<li>Withdraw consent for data processing where applicable.</li>
</ul>
<p>To exercise these rights, contact us using the details below.</p>

<h2>9. International Users</h2>
<p>If you access DevCraft from outside India, your information may be transferred to and processed in India. By using our services, you consent to this transfer.</p>

<h2>10. Changes to This Policy</h2>
<p>We may update this Privacy Policy periodically. Continued use of the platform after changes constitutes acceptance of the revised policy.</p>

<h2>11. Grievance Officer / Data Contact</h2>
<p>For any privacy-related concerns or data requests, contact:</p>
<p>Name: Rutuj Dhodapkar<br>
Email: rutujdhodapkar@gmail.com</p>

<h2>12. Contact Information</h2>
<p>Email: rutujdhodapkar@gmail.com<br>
Website: https://devcraft.fennark.xyz</p>

<footer>
DevCraft is an independent educational and skill-development platform and is not a registered company, university, government organization, or accredited certification body.
<br><br>
© 2026 DevCraft. All Rights Reserved.
</footer>

</div>
</body>
</html>`;

const refundHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DevCraft - Refund Policy</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial, Helvetica, sans-serif;background:#ffffff;color:#222;line-height:1.7;}
.container{max-width:1000px;margin:auto;padding:50px 25px;}
h1{font-size:34px;margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:12px;}
h2{font-size:22px;margin-top:35px;margin-bottom:15px;}
p{margin-bottom:15px;}
ul{margin-left:25px;margin-bottom:15px;}
li{margin-bottom:8px;}
.notice{background:#f5f5f5;border-left:5px solid #000;padding:18px;margin:25px 0;}
footer{border-top:1px solid #ddd;padding-top:30px;color:#666;font-size:14px;text-align:center;margin-top:60px;}
a{color:#000;}
</style>
</head>
<body>
<div class="container">

<h1>Refund Policy</h1>
<p><strong>Last Updated:</strong> July 6, 2026</p>

<div class="notice">
All payments made to DevCraft are generally non-refundable.
</div>

<h2>1. Eligible Refund Circumstances</h2>
<p>Refund requests may only be considered under valid circumstances, including:</p>
<ul>
<li>Duplicate payment.</li>
<li>Technical error resulting in an incorrect charge.</li>
<li>Payment received but service was not delivered.</li>
<li>Exceptional situations approved by DevCraft at its sole discretion.</li>
</ul>

<h2>2. Refunds Will Not Be Issued For</h2>
<ul>
<li>Change of mind.</li>
<li>Failure to complete an internship.</li>
<li>Dissatisfaction based on personal expectations.</li>
<li>Certificate rejection by employers or institutions.</li>
<li>Failure to obtain employment or placement.</li>
<li>Failure to secure academic credits.</li>
</ul>

<h2>3. How to Request a Refund</h2>
<p>To request a refund, email us at the contact address below with:</p>
<ul>
<li>Your registered name and email.</li>
<li>Payment transaction ID / receipt.</li>
<li>Reason for the refund request.</li>
</ul>

<h2>4. Processing Timeline</h2>
<p>If approved, refunds will be processed to the original payment method within 7–15 business days. Processing time may vary depending on your bank or payment provider.</p>

<h2>5. Chargebacks and Disputes</h2>
<p>Users are encouraged to contact DevCraft directly before initiating a chargeback with their bank or payment provider. Unauthorized chargebacks filed without prior communication may result in suspension of platform access pending resolution.</p>

<h2>6. Partial Refunds</h2>
<p>In cases where a portion of a service has already been delivered (e.g., partial internship completion, issued materials), DevCraft reserves the right to issue a partial refund reflecting the value of services already rendered.</p>

<h2>7. Contact Information</h2>
<p>For refund requests or questions, contact:<br>
Email: rutujdhodapkar@gmail.com</p>

<footer>
DevCraft is an independent educational and skill-development platform and is not a registered company, university, government organization, or accredited certification body.
<br><br>
© 2026 DevCraft. All Rights Reserved.
</footer>

</div>
</body>
</html>`;

await db.collection("siteConfig").doc("terms").set({ value: termsHTML, updatedAt: new Date().toISOString() }, { merge: true });
console.log("Saved: terms");

await db.collection("siteConfig").doc("privacy").set({ value: privacyHTML, updatedAt: new Date().toISOString() }, { merge: true });
console.log("Saved: privacy");

await db.collection("siteConfig").doc("refund").set({ value: refundHTML, updatedAt: new Date().toISOString() }, { merge: true });
console.log("Saved: refund");

console.log("\nAll policy pages written to Cosmos DB.");
process.exit(0);
