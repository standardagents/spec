// After a spec deploy, start a rebuild of standardagents.ai, whose
// /llms-full.txt includes this site's /llms-full.txt at build time.
// STANDARDAGENTS_AI_DEPLOY_HOOK holds the Cloudflare Pages deploy hook URL of
// the standardagentbuilder-com project. Without it, the script prints a
// notice and exits successfully, so a deploy never fails on this step.
const hook = process.env.STANDARDAGENTS_AI_DEPLOY_HOOK

if (!hook) {
  console.log('STANDARDAGENTS_AI_DEPLOY_HOOK is not set; standardagents.ai was not rebuilt.')
  process.exit(0)
}

try {
  const response = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`the deploy hook answered ${response.status}`)
  console.log('Started a standardagents.ai rebuild.')
} catch (error) {
  console.warn(`standardagents.ai was not rebuilt: ${error.message}`)
}
