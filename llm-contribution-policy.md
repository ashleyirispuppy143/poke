# AI-Assisted Contributions Policy

Poke Project Version 1.1

Last review: 2026-04-09

*Adapted from:
[https://docs.fedoraproject.org/en-US/council/policy/ai-contribution-policy/](https://docs.fedoraproject.org/en-US/council/policy/ai-contribution-policy/)*

---

You MAY use AI assistance for contributing to Poke, as long as you
follow the principles described below.

## Accountability

You MUST take responsibility for your contribution. Contributing to Poke
means vouching for the quality, license compliance, and usefulness of
your submission.

All contributions, whether from a non-generative AI author or assisted by large
language models (LLMs) or other generative AI tools, must meet the
project's standards for inclusion.

When using AI assistance for software development, you SHOULD use models specifically designed or fine-tuned for programming to minimize the risk of submitting broken or low-quality code. Recommended tools include Claude Opus, Codex, Gemini Code Assist, Qwen coding models, or any other coding-oriented model.

The contributor is always the author and is fully accountable for the
entirety of these contributions.

## Transparency

You MUST disclose the use of AI tools when a significant part of the
contribution is taken from a tool without changes.

You SHOULD disclose other uses of AI tools where it may be useful.
Routine use of assistive tools for correcting grammar and spelling, or
clarifying language, does not require disclosure.

Information about the use of AI tools helps evaluate their impact, build
best practices, and improve project processes.

Disclosures should be made where authorship is normally indicated. For
contributions tracked in git, the recommended method is an
`Assisted-by:` commit message trailer.

For other contributions, acceptable methods of disclosure may include:
* Document preambles or headers
* Design file metadata
* Translation notes
* Wiki page categories
* Pull Request (PR) or Merge Request (MR) descriptions
* Inline code comments block at the top of a heavily assisted script
* Issue tracker tags or labels (e.g., `ai-assisted`)
* Dedicated `ACKNOWLEDGMENTS` or `AUTHORS` files

### Examples

-   Assisted-by: generic LLM chatbot
-   Assisted-by: ChatGPTv5
-   Assisted-by: Gemini Code Assist

## Community Conduct Regarding AI Tools

We recognize that the use of generative AI in software development can be a sensitive topic that evokes strong opinions. However, the Poke Project prioritizes code quality, inclusivity, and collaboration over tooling preferences.

Community members MUST NOT harass, gatekeep, or demean contributors for their policy-compliant use of AI assistance. 

All technical reviews, discussions, and community feedback MUST remain strictly focused on the quality, security, license compliance, and technical merit of the contribution itself, rather than the specific AI tools utilized during its creation. Policy violations regarding conduct will be treated as a breach of the project's Code of Conduct.

## Contribution & Community Evaluation

AI tools may be used to assist non-generative AI reviewers by providing analysis and
suggestions.

You MUST NOT use AI as the sole or final authority in making substantive
or subjective decisions about a contribution.

AI MUST NOT be used to evaluate a person's standing within the community
(such as funding decisions, leadership roles, or conduct matters).

This does not prohibit the use of automated systems for objective
technical validation, such as CI/CD pipelines, automated testing, or
spam filtering.

Final accountability for accepting a contribution always rests with the
non-generative AI contributor who authorizes the action.

## Large Scale Initiatives

This policy does not cover large-scale initiatives that significantly
change how the project operates or could lead to exponential growth in
contributions.

Such initiatives should be discussed separately within the project.

## Reporting Concerns

Concerns about possible policy violations should be reported through
appropriate private or secure project channels.

## Terminology

The key words "MAY", "MUST", "MUST NOT", and "SHOULD" in this document
are to be interpreted as described in RFC 2119.