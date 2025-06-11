export default `# TimeCrate Lookup Service Documentation

      The TimeCrate Lookup Service is responsible for managing the rules of admissibility for TimeCrate tokens and handling queries related to them.

      ## Example
      \`\`\`typescript
      const timeCrateService = new TimeCrateLookupService()
      const answer = await timeCrateService.lookup({
        query: { outpoint: 'txid.vout' },
        service: 'ls_timecrate'
      })
      console.log(answer)
      \`\`\``
