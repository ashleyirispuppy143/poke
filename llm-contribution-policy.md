# Algorithmic Collaboration and Contribution Guidelines

**Version:** 2.1.0 • **Last Review:** 2026-04-20

*Originally adapted from the [Fedora Project AI Contribution Policy](https://docs.fedoraproject.org/en-US/council/policy/ai-contribution-policy/)*

> **Document Distribution & Modification:** Everyone is permitted to copy and distribute verbatim copies of this document, but changing it is not allowed. Official modifications to this policy for the Poke Project may only be enacted by the project founder or through formal community consensus and voting mechanisms.

---

## 1. Definitions

> **In short:** Clarifying what we mean by AI, automation, and the specific terms used in this policy.

* **RFC Terminology:** The key words "MAY", "MUST", "MUST NOT", and "SHOULD" in this document are to be interpreted as described in RFC 2119.
* **LLM / Generative AI Coding:** The automated synthesis of functional source code, scripts, or configuration files by neural network models in response to natural language prompts or broad context windows. This refers to generating multi-line logic, algorithms, or architectural scaffolding. It does *not* include standard IDE auto-completion (e.g., closing brackets or single-line syntax suggestions).
* **AI-Assisted Review Tools:** Applications or bots that use Large Language Models to summarize Pull Requests, suggest code improvements, find bugs, or analyze security flaws during the review process.
* **Deterministic Automation:** Traditional software tools like standard static linters, CI/CD pipelines, and regex-based code formatters (e.g., Prettier, Black). These follow explicit rules rather than predictive generation and are not restricted by this policy.
* **Generative AI Assets:** Any non-text media, including images, video, audio, or 3D models, synthesized by machine learning algorithms (e.g., Midjourney, DALL-E, Stable Diffusion).

---

## 2. Accountability

> **In short:** If you submit it, you own it. You are responsible for verifying the AI didn't write broken, insecure, or legally sketchy code.

You **MUST** take full responsibility for your contribution. Submitting to Poke means you personally vouch for the code's quality, security, license compliance, and overall usefulness.

All contributions must meet the project's standards for inclusion, regardless of whether they originate from an individual author or are assisted by generative AI tools. 

When utilizing AI assistance for software development, you **SHOULD** use models explicitly trained, fine-tuned, and licensed for programming tasks to minimize the risk of submitting broken, vulnerable, or legally ambiguous code (e.g., Claude Opus, Codex, Gemini Code Assist, Qwen coding models). The contributor remains the sole author of record and is fully accountable for the entirety of the submission.

---

## 3. Permitted Usage and Prohibitions

> **In short:** You can use AI for up to 75% of your code in most cases, or 90% for specific routine tasks. Generative AI assets, 100% AI documentation, and using AI for security logic without extreme oversight are banned.

### Code Generation Thresholds (75% vs. 90%)
To guarantee contributors maintain a thorough understanding of the logic they submit, we enforce strict limits on how much of a single contribution can be entirely AI-generated.

* **The 75% Standard Limit:** For the vast majority of contributions, you **MAY** use generative AI to author up to **75%** of the submitted code. The remaining 25% (or more) must consist of contributor-authored logic, structural design, manual refactoring, or integration wiring to make certain the code fits organically into the project architecture.
  
  > **Primary Applications for the 75% Limit:**
  > * **Core Logic:** Standard feature development and business logic implementation.
  > * **Maintenance:** Bug fixes, patch creations, and issue resolutions.
  > * **Networking:** API integrations, endpoint creations, and data fetching.
  > * **Algorithms:** Complex algorithmic problem-solving.
  > * **Design:** UI/UX component building and front-end styling.

* **The 90% Exception Limit:** You **MAY** use generative AI to author up to **90%** of the code *only* for highly specific, routine, or strictly structured scenarios. Utilizing this higher threshold generally requires prior discussion with project maintainers before submission.
  
  > **Approved Scenarios for the 90% Limit:**
  > * **Boilerplate & Scaffolding:** Generating massive boilerplate files or initial project structural foundations.
  > * **Data Structures:** Creating large and repetitive data arrays (e.g., massive configuration maps, dictionaries, or enums).
  > * **Bulk Refactoring:** Automated repository-wide refactoring (e.g., bulk-renaming or migrating deprecated function calls across hundreds of files).

### Other Permitted Usages
The Poke Project explicitly allows and encourages the use of AI tools for the following tasks:
* **Reviewing Bugs & Code:** Utilizing AI-Assisted Review Tools to find bugs, suggest code improvements, or analyze potential flaws during general code reviews is explicitly allowed and encouraged.
* **Test Generation:** Writing unit, integration, or end-to-end tests for existing contributor-verified logic.
* **Code Explanation:** Using AI to summarize, document, or explain complex legacy codebases.
* **Translation Assistance:** Translating application strings or localization files, provided an individual reviews the final output for cultural context.

### Strict Prohibitions
The Poke project places absolute limits on specific types of generative content to maintain project integrity and security:
* **Generative AI Assets:** You **MUST NOT** submit Generative AI Assets of any kind (images, video, audio, 3D models) in Pull Requests, Merge Requests, or repository assets. 
* **Fully Automated Documentation:** You **MUST NOT** submit documentation that is exclusively (100%) generated by GenAI. Substantial individual authorship and structuring are required.
* **Security & Cryptographic Logic:** You **MUST NOT** use AI to independently write or alter cryptographic implementations, authentication flows, or security-critical logic without explicit, documented expert review.
* **Proprietary Data Leakage:** You **MUST NOT** paste proprietary, unreleased, or sensitive project data into public, consumer-grade AI models that use inputs for training.
* **Obfuscated Code Submission:** You **MUST NOT** submit unreadable, AI-generated "spaghetti code" or heavily obfuscated logic just because it mathematically functions; all code must remain maintainable by individual contributors.

---

## 4. Transparency and Disclosure Thresholds

> **In short:** Tell us if you used AI and which tools you used. The more AI you use, the more formal the disclosure needs to be.

Information regarding the use of AI tools helps project maintainers evaluate impact, build better review practices, and improve our automated pipelines. 

### Major Assistance (50% or more)
You **MUST** formally disclose the use of AI tools when **50% or more** of the code in your contribution is generated via an LLM or GenAI. 
* **Git Commits:** You must add an `Assisted-by:` commit message trailer at the very bottom of your commit message (e.g., `Assisted-by: Gemini Code Assist`).
* **Multiple Tools:** If you used multiple tools, you must list them all (e.g., `Assisted-by: ChatGPT, GitHub Copilot`).

### Minor Assistance (Under 50%)
Even if the AI-generated code constitutes less than 50% of the submission, you **MUST** still declare its use in your Pull Request (PR) or Merge Request (MR) description. A simple note such as *"I used a generic LLM coder for portions of this pull request"* is sufficient.

### Documentation Fragments
While 100% AI documentation is banned, if you use AI to draft or format minor sections of a larger document, you **SHOULD** disclose this in the PR description or at the bottom of the document file.

### Prompt Context (Optional but Encouraged)
Contributors are highly encouraged to include the core prompts they used to generate major logic blocks in the PR description. This helps reviewers understand the intent behind the generated code.

*(Note: Routine use of assistive tools strictly for correcting grammar, spelling, or clarifying contributor-written language does not require disclosure.)*

---

## 5. Community Conduct

> **In short:** Be respectful. Review the code, not the tool. Harassing someone for using AI is a Code of Conduct violation.

We recognize that generative AI in software development evokes strong opinions. However, the Poke Project prioritizes code quality, inclusivity, and collaboration over tooling preferences.

Community members **MUST NOT** harass, gatekeep, or demean contributors for their policy-compliant use of AI assistance. 

All technical reviews, discussions, and community feedback **MUST** remain strictly focused on the quality, security, license compliance, and technical merit of the contribution itself, rather than the specific AI tools utilized during its creation. 

---

## 6. Evaluation and Automated Approvals

> **In short:** AI can help review code, but contributors have the final say on merges and community decisions.

* **AI-Assisted Review Tools** **MAY** be used to assist individual reviewers by providing static analysis and suggestions.
* You **MUST NOT** use AI as the sole or final authority in making substantive or subjective decisions about a contribution's merge status.
* AI **MUST NOT** be used to evaluate a person's standing within the community (e.g., funding decisions, leadership roles, or conduct matters).

This does not prohibit the use of **Deterministic Automation** systems for objective technical validation, such as CI/CD pipelines, static linters, automated testing, or spam filtering. Final accountability for accepting any contribution rests exclusively with the individual reviewer who authorizes the merge.

---

## 7. Policy Violations and Consequences

> **In short:** Break the rules, and your PR gets closed. Keep breaking them, and you may be banned from contributing.

Adherence to this policy is mandatory. Failure to comply with these guidelines will result in the following actions:

1.  **Rejected Contributions:** PRs or MRs found to violate the 75%/90% code caps (without prior exception), or containing prohibited Generative AI Assets, documentation, or security flaws, **WILL** be immediately closed. 
2.  **Undeclared Usage:** If AI usage meeting the disclosure thresholds is discovered to be undeclared, the contributor will be issued a warning and asked to amend their PR/commit history.
3.  **Repeated Violations:** Contributors who repeatedly ignore disclosure rules or submit prohibited AI content **MAY** face temporary or permanent bans from the repository.
4.  **Conduct Violations:** Harassment regarding AI usage is treated as a severe breach of the project's Code of Conduct and will result in disciplinary action up to and including a permanent ban from the community.

---

## 8. Large Scale Initiatives & Reporting Concerns

> **In short:** Mass-automated PR bots need special permission. Report bad behavior privately.

**Large Scale Initiatives:** This policy does not cover large-scale, automated initiatives that significantly change how the project operates or could lead to an exponential flood of automated contributions. Such initiatives require separate, prior discussion and approval by the project council.

**Reporting Concerns:** Concerns about possible policy violations, including undeclared AI use or AI-related Code of Conduct breaches, should be reported through appropriate private or secure project channels.

---

## Changelog

**v2.1.0 (2026-04-20)**
* Lowered the standard permitted code generation limit to 75%, retaining the 90% allowance strictly for specific scenarios like automated refactoring and heavy boilerplate.
* Added a dedicated section detailing exactly where the 75% standard limit and the 90% exception limit apply, complete with clear formatting.
* Added explicit approval for using AI-Assisted Review Tools to find bugs and conduct general code reviews.
* Replaced "Generative AI Images" with the broader "Generative AI Assets" throughout the document to align with established definitions.
* Removed unused project labels from the document header and clarified the adaptation origin.
* Confirmed all terminology under the Definitions section is actively referenced within the policy rules.
* Removed specific wording per community request to improve document flow.