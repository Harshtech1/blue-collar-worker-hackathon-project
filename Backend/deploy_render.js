async function updateService() {
  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;
  const branch = process.env.RENDER_BRANCH;

  if (!apiKey || !serviceId || !branch) {
    console.error("Missing required environment variables: RENDER_API_KEY, RENDER_SERVICE_ID, RENDER_BRANCH");
    process.exit(1);
  }

  const response = await fetch(`https://api.render.com/v1/services/${serviceId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ branch })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to update service:", response.status, errorText);
    process.exit(1);
  }
  
  const data = await response.json();
  console.log("Service updated successfully:", data.id, "Branch:", data.branch);
  
  // Now explicitly trigger a deploy
  const deployResponse = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clearCache: "do_not_clear" })
  });

  if (!deployResponse.ok) {
    const errorText = await deployResponse.text();
    console.error("Failed to trigger deploy:", deployResponse.status, errorText);
    process.exit(1);
  } else {
    const deployData = await deployResponse.json();
    console.log("Triggered deploy:", deployData.id, "Status:", deployData.status);
  }
}

updateService().catch((error) => {
  console.error("Render deploy script failed:", error);
  process.exit(1);
});
