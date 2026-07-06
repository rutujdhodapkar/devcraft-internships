const CLIENT_ID = "777c3ev3udb0o2";
const REDIRECT_URI = "https://www.linkedin.com/developers/tools/oauth/redirect";
const SCOPE = "w_member_social r_liteprofile r_emailaddress";

const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}`;

console.log("=".repeat(60));
console.log("STEP 1: Open this URL in your browser and authorize:");
console.log("=".repeat(60));
console.log(authUrl);
console.log();
console.log("After authorizing, you'll be redirected to a URL.");
console.log("Copy the 'code' parameter from the URL.");
console.log();
console.log("STEP 2: Run this script again with the code:");
console.log("  node scripts/get-linkedin-token.js YOUR_AUTH_CODE");
console.log();

const code = process.argv[2];
if (!code) process.exit(0);

(async () => {
  console.log("Exchanging code for tokens...");
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Error:", data.error_description || data.error);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("SUCCESS! Set these GitHub secrets:");
  console.log("=".repeat(60));
  console.log();
  console.log(`gh secret set LINKEDIN_ACCESS_TOKEN --body "${data.access_token}"`);
  console.log(`gh secret set LINKEDIN_REFRESH_TOKEN --body "${data.refresh_token}"`);
  console.log();

  console.log("To find your person ID:");
  console.log(`curl -H "Authorization: Bearer ${data.access_token}" https://api.linkedin.com/v2/userinfo`);
  console.log("Copy the 'sub' value and set:");
  console.log("gh secret set LINKEDIN_PERSON_ID --body \"your_sub\"");
})();
