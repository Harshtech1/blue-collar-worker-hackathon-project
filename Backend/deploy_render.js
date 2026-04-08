async function updateService() {
  const apiKey = "rnd_3i278joTidEYgKy1Nv5xi1bPRLvS";
  const serviceId = "srv-d7aiiah5pdvs73eb0cqg";
  const branch = "phase-2-payments-socials";

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
    console.error("Failed to trigger deploy:", await deployResponse.text());
  } else {
    const deployData = await deployResponse.json();
    console.log("Triggered deploy:", deployData.id, "Status:", deployData.status);
  }
}

updateService();
