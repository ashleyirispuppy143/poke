# Algorithmic Collaboration and Contribution Guidelines

**Version:** 2.1.5-final • **Last Review:** 2026-04-20

**Author:** Güneş Şevval Arjinya Melisoy AKA Ashley Íris Celeste ([https://ashleyirispup.cat](https://ashleyirispup.cat))

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

Because AI models lack legal, ethical, and technical agency, you **MUST** take full responsibility for your contribution. Submitting to Poke means you personally vouch for the code's quality, security, license compliance, and overall usefulness. 

All contributions must meet the project's standards for inclusion, regardless of whether they originate entirely from an individual author or are heavily assisted by generative AI tools. 

**Best Practices for Accountability:**
When utilizing AI assistance for software development, you **SHOULD** use models explicitly trained, fine-tuned, and licensed for programming tasks. This minimizes the risk of submitting broken, vulnerable, or legally ambiguous code (e.g., Claude Opus, Codex, Gemini Code Assist, Qwen coding models). The contributor remains the sole author of record and is fully accountable for the entirety of the submission.

---

## 3. Permitted Usage and Prohibitions

> **In short:** You can use AI for up to 75% of your code in most cases, or 90% for specific routine tasks. Generative AI assets, 100% AI documentation, and using AI for security logic without extreme oversight are banned.

### Code Generation Thresholds (75% vs. 90%)
**Why do we have limits?** To guarantee that contributors maintain a thorough, working understanding of the logic they submit. We want to avoid "black box" merges where neither the author nor the reviewer fully understands how the underlying code operates.

#### The 75% Standard Limit
For the vast majority of contributions, you **MAY** use generative AI to author up to **75%** of the submitted code. The remaining 25% (or more) must consist of contributor-authored logic, structural design, manual refactoring, or integration wiring to make certain the code fits organically into the project architecture.

**Applicable Scenarios for the 75% Limit:**
* Core feature development and business logic implementation.
* Bug fixes, patch creations, and issue resolutions.
* API integrations, endpoint creations, and data fetching pipelines.
* Complex algorithmic problem-solving and mathematical models.
* UI/UX component building and front-end styling.

#### The 90% Exception Limit
You **MAY** use generative AI to author up to **90%** of the code *only* for highly specific, routine, or strictly structured scenarios where manual typing is primarily drudgery. Utilizing this higher threshold generally requires prior discussion with project maintainers before submission.

**Applicable Scenarios for the 90% Limit:**
* Generating massive boilerplate files or initial project structural foundations.
* Creating large and repetitive data arrays (e.g., configuration maps, dictionaries, localized language strings).
* Automated repository-wide refactoring (e.g., bulk-renaming, structural updates across hundreds of files).
* Porting libraries from one language or syntax to another.
* Autogenerating API clients or SDK wrappers directly from schemas.

### Other Permitted Usages
The Poke Project explicitly allows and encourages the use of AI tools for the following workflow enhancements:
* **Reviewing Bugs & Code:** Utilizing AI-Assisted Review Tools to find bugs, suggest code improvements, or analyze potential flaws during general code reviews.
* **Test Generation:** Writing unit, integration, or end-to-end tests for existing contributor-verified logic.
* **Code Explanation:** Using AI to summarize, document, or explain complex legacy codebases.
* **Translation Assistance:** Translating application strings or localization files (provided an individual reviews the final output for cultural context).

### Strict Prohibitions
To protect project security, maintainability, and copyright integrity, the following are strictly banned:
* **Generative AI Assets:** You **MUST NOT** submit Generative AI Assets of any kind (images, video, audio, 3D models) in Pull Requests, Merge Requests, or repository assets. 
* **Fully Automated Documentation:** You **MUST NOT** submit documentation that is exclusively (100%) generated by GenAI. Documentation requires substantial individual authorship and structuring to remain accurate and helpful.
* **Security & Cryptographic Logic:** You **MUST NOT** use AI to independently write or alter cryptographic implementations, authentication flows, or security-critical logic without explicit, documented expert review. AI models frequently hallucinate secure logic.
* **Proprietary Data Leakage:** You **MUST NOT** paste proprietary, unreleased, or sensitive project data into public, consumer-grade AI models that use inputs for training.
* **Obfuscated Code Submission:** You **MUST NOT** submit unreadable, AI-generated "spaghetti code" or heavily obfuscated logic just because it mathematically functions.

---

## 4. Transparency and Disclosure Thresholds

> **In short:** Tell us if you used AI and which tools you used. The more AI you use, the more formal the disclosure needs to be.

**Why disclose?** Transparency helps project maintainers properly gauge the effort required for a code review, track the impact of AI on our codebase over time, and adjust our CI/CD pipelines to look for common generative pitfalls.

### Estimating Thresholds
We do not require exact line-by-line automated percentage counts. Threshold percentages (50%, 75%, 90%) are based on a good-faith estimate of the overall logic, structure, and text contributed by generative AI versus individual authorship within a given PR or commit.

### Major Assistance (50% or more)
If your contribution crosses the 50% threshold of generated content, formal git-level disclosure is required.
* **How to disclose:** You **MUST** add an `Assisted-by:` commit message trailer at the very bottom of your commit message. 
* **Format:** `Assisted-by: [Tool Name]` (If multiple tools were used, list them comma-separated: `Assisted-by: ChatGPT, GitHub Copilot`).
* **Example:** You can view a formatting example in [this commit](https://codeberg.org/ashleyirispuppy/poke/commit/3976cbded877098146daa8a83da47ebf860bbc4d).

### Minor Assistance (Under 50%)
If the AI-generated code constitutes less than 50% of the submission, you **MUST** still declare its use to assist reviewers, but git trailers are not required.
* **How to disclose:** Leave a simple contextual note in your Pull Request (PR) or Merge Request (MR) description. 
* **Example:** *"I used a generic LLM coder to help write the regex and boilerplate for this feature."*

### Documentation Fragments
While 100% AI documentation is banned, if you use AI to draft, format, or structure minor sections of a larger document, you **SHOULD** disclose this in the PR description or as a footnote at the bottom of the document file.

### External Sources and False Positives
We recognize that code origins can sometimes be ambiguous, and AI detection tools are deeply flawed. To protect contributors and maintain a welcoming environment, we operate on a principle of trust.

**Code from External Platforms (e.g., StackOverflow, Forums):**
If you incorporate code snippets from external forums, documentation, or other free software repositories and are genuinely unsure if the original author used generative AI, you do not need to apply an AI disclosure trailer. You are still fully accountable for the code's quality, security, and license compliance, and you must follow standard free software attribution practices.

**Legacy Code and Older Projects:**
Copying boilerplate, logic, or scripts from older, pre-LLM codebases does not require disclosure, even if a modern AI model would generate something remarkably similar today. 

**The "False Positive" Rule:**
The Poke Project does not rely on automated "AI detection" tools, as they are notoriously unreliable and frequently flag neurodivergent phrasing, non-native English writing, or highly structured coding styles as AI-generated.
* You will never be penalized if a third-party tool inaccurately flags your work.
* Project maintainers **MUST NOT** reject code, block PRs, or aggressively interrogate contributors based purely on "AI vibes" or suspicions that code "looks generated."
* You are only required to disclose actual, active use of generative AI tools during your personal contribution process.

### Prompt Context (Optional but Encouraged)
Contributors are highly encouraged to include the core prompts they used to generate major logic blocks in the PR description. Providing the prompt context helps reviewers understand the intent behind the generated code, trace logical decisions, and evaluate potential edge cases more effectively.

*(Note: Routine use of assistive tools strictly for correcting grammar, spelling, or clarifying contributor-written language does not require disclosure.)*

---

## 5. Community Conduct

> **In short:** Be respectful. Review the code, not the tool. Harassing someone for using AI is a Code of Conduct violation.

**Why we have this policy:** Software development tooling is evolving rapidly, and individual workflows vary wildly. The Poke Project enacted these guidelines to establish clear boundaries, prevent gatekeeping, and foster a psychologically safe environment for all contributors. We evaluate the *merit* of the contribution, not the *method* of its generation. 

* **No Gatekeeping:** Community members **MUST NOT** harass, gatekeep, mock, or demean contributors for their policy-compliant use of AI assistance. 
* **Focus on the Code:** All technical reviews, discussions, and community feedback **MUST** remain strictly focused on the quality, security, license compliance, and technical merit of the contribution itself. Debates about the validity of AI as a tool do not belong in PR review threads.
* **Enforcement:** Hostility toward contributors utilizing AI within these guidelines will be treated as a severe breach of the Code of Conduct.

---

## 6. Evaluation and Automated Approvals

> **In short:** AI can help review code, but contributors have the final say on merges and community decisions.

* **AI-Assisted Review Tools** **MAY** be used to assist individual reviewers by providing static analysis and suggestions.
* You **MUST NOT** use AI as the sole or final authority in making substantive or subjective decisions about a contribution's merge status. AI cannot press the "Merge" button.
* AI **MUST NOT** be used to evaluate a person's standing within the community (e.g., funding decisions, leadership roles, or conduct matters).

This does not prohibit the use of **Deterministic Automation** systems for objective technical validation, such as CI/CD pipelines, static linters, automated testing, or spam filtering. Final accountability for accepting any contribution rests exclusively with the individual reviewer who authorizes the merge.

---

## 7. Policy Violations and Consequences

> **In short:** Break the rules, and your PR gets closed. Keep breaking them, and you may be banned from contributing.

Adherence to this policy is mandatory. Failure to comply with these guidelines will result in the following progressive actions:

1.  **Rejected Contributions:** PRs or MRs found to violate the 75%/90% code caps (without prior exception), or containing prohibited Generative AI Assets, automated documentation, or security flaws, **WILL** be immediately closed. 
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

**v2.1.5-final (2026-04-20)**
* **Final Version:** Marked as the ultimate, definitive draft for the 2.x policy line.
* Replaced all instances of "open-source" with "free software" to better align with project terminology.
* Greatly expanded the "External Sources and False Positives" section. Added explicit protections for contributors against unreliable AI-detection tools and "AI vibes" accusations, and clarified rules around legacy code and external forum snippets.
* Improved formatting and readability of "Permitted Usage and Prohibitions" and "Transparency and Disclosure Thresholds" by utilizing flatter list structures and bolded headers for easier scanning.

**v2.1.4-final (2026-04-20)**
* Added the "External Sources and False Positives" section to clarify rules around copying code of unknown origins (e.g., StackOverflow) and address concerns regarding unreliable AI detection tools.

**v2.1.3-final (2026-04-20)**
* Formatted the author attribution to include the website link next to the name, rather than as a direct name hyperlink.
* Overhauled section formatting for better readability, utilizing sub-headers, rationale blocks ("Why we do this"), and bulleted lists.
* Expanded the "Community Conduct" section to explicitly explain the philosophy behind the policy (preventing gatekeeping, prioritizing merit over method, fostering safety).
* Streamlined "Transparency and Disclosure Thresholds" to clearly separate *how* to disclose from *when* to disclose.

**v2.1.2 (2026-04-20)**
* Added explicit author attribution to the document header.
* Expanded and refined the "Code Generation Thresholds" section to include more concrete examples for both the 75% standard limit and the 90% exception limit.
* Significantly enhanced the "Transparency and Disclosure Thresholds" section, adding guidance on estimating thresholds and clarifying formats for git trailers and PR descriptions.

**v2.1.1 (2026-04-20)**
* Added a practical commit example link demonstrating the `Assisted-by:` git trailer format.

**v2.1.0 (2026-04-20)**
* Lowered the standard permitted code generation limit to 75%, retaining the 90% allowance strictly for specific scenarios like automated refactoring and heavy boilerplate.
* Added a dedicated section detailing exactly where the 75% standard limit and the 90% exception limit apply, complete with clear formatting.
* Added explicit approval for using AI-Assisted Review Tools to find bugs and conduct general code reviews.
* Replaced "Generative AI Images" with the broader "Generative AI Assets" throughout the document to align with established definitions.
* Removed unused project labels from the document header and clarified the adaptation origin.
* Confirmed all terminology under the Definitions section is actively referenced within the policy rules.
* Removed specific wording per community request to improve document flow.