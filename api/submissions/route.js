export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { industry, headache, team_size, name, email, org, phone, consent, timestamp } = req.body;

  // Log to file (in production, route to CRM)
  const logEntry = {
    timestamp: new Date().toISOString(),
    submissionData: {
      industry,
      headache,
      team_size,
      name,
      email,
      org,
      phone,
      consent,
      timestamp
    }
  };

  console.log('Assessment submission:', JSON.stringify(logEntry, null, 2));

  // Return success
  return res.status(200).json({
    success: true,
    message: 'Assessment submitted. We will contact you within 24 hours.',
    data: logEntry
  });
}
APIJS

# Create .gitignore
cat > .gitignore << 'GITIGNORE'
node_modules/
.vercel/
.env.local
*.log
GITIGNORE

# Commit everything
git add .
git commit -m "Enhanced Ops Ninja — initial deployment"

echo "✅ Project structure ready at ~/enhanced-ops-ninja"
echo "Next: git push to GitHub, then connect to Vercel"

