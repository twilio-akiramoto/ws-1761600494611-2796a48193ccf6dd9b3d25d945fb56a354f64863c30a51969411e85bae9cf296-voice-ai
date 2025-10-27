/**
 * Notify Workshop of Railway Deployment
 *
 * This script runs when the Railway deployment starts.
 * It pings the workshop app with the deployment URL so students
 * don't have to manually copy/paste the URL.
 */

// Get the Railway public domain from environment
const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
const railwayStaticUrl = process.env.RAILWAY_STATIC_URL;
const workshopUrl = process.env.WORKSHOP_CALLBACK_URL || 'https://voice-ai-workshop.vercel.app';
const sessionId = process.env.WORKSHOP_SESSION_ID;

async function notifyWorkshop() {
  // Determine the public URL
  let deploymentUrl = null;

  if (railwayPublicDomain) {
    deploymentUrl = `wss://${railwayPublicDomain}`;
  } else if (railwayStaticUrl) {
    deploymentUrl = railwayStaticUrl.replace('https://', 'wss://');
  }

  if (!deploymentUrl) {
    console.log('⚠️ No Railway public domain found. Skipping workshop notification.');
    console.log('   This is normal for local development.');
    return;
  }

  if (!sessionId) {
    console.log('⚠️ No WORKSHOP_SESSION_ID found. Skipping workshop notification.');
    console.log('   This is normal if deployed outside of the workshop.');
    return;
  }

  console.log(`📡 Notifying workshop of deployment: ${deploymentUrl}`);
  console.log(`   Session ID: ${sessionId}`);

  try {
    const response = await fetch(`${workshopUrl}/api/railway-deployed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        deploymentUrl: deploymentUrl,
        timestamp: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (response.ok) {
      console.log('✅ Successfully notified workshop of deployment!');
      console.log('   Students can now continue with the workshop automatically.');
    } else {
      console.log(`⚠️ Workshop notification returned status ${response.status}`);
      console.log('   This may be normal if the workshop session has expired.');
    }
  } catch (error) {
    console.log('⚠️ Could not notify workshop:', error.message);
    console.log('   This is normal if the workshop URL is unreachable.');
    console.log('   The deployment still works - students can manually enter the URL.');
  }
}

// Run the notification
notifyWorkshop().catch(err => {
  console.error('Error in deployment notification:', err);
  // Don't exit - this is not critical to the server running
});
