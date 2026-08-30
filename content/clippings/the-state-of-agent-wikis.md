---
title: "The State of Agent Wikis"
source: "https://x.com/mem0ai/status/2079585032587694582?s=46"
author:
  - "[[@mem0ai]]"
published: 2026-07-21
created: 2026-07-21
description: "In April 2026, Andrej Karpathy wrote a GitHub Gist. He describes a method in it. He calls the method the LLM Wiki.Four teams built the same ..."
tags:
  - "clippings"
---
![图像](https://pbs.twimg.com/media/HNwmIETa0AAkHru?format=jpg&name=large)

In April 2026, Andrej Karpathy wrote a GitHub Gist. He describes a method in it. He calls the method the LLM Wiki.

Four teams built the same thing after that. Cognition built DeepWiki. Factory built AutoWiki. LangChain released OpenWiki. Garry Tan released GBrain.

The method is the same in all four systems. An LLM reads your source documents one time. It writes the information into markdown pages. It keeps the pages correct when the sources change. The agent reads these pages. The agent does not read the source documents again for each question.

People call these systems agent wikis. This article tells you what they are. It tells you what each team built. It tells you the limits of the method. It also tells you one important difference that many people miss.

## The idea: compile at ingest, not at query

The usual method to give a model a large set of documents is retrieval. You put the documents in a database. You divide the documents into parts. You make embeddings for the parts. For each question, the system finds the related parts.

![图像](https://pbs.twimg.com/media/HNwiw_kbEAArsxT?format=jpg&name=large)

This method works. It also has a problem. The system does not keep the results. It builds each answer from the raw parts again. The tenth answer is not better than the first answer. You pay the cost of the work ten times.

An agent wiki moves this cost. The model does the work one time, when it reads the source. It writes the results into pages. The pages stay.

The model does these steps when a new source comes in. It reads the source. It changes the related pages. It corrects the summaries. It marks the information that disagrees with the pages.

Both methods are correct. They are different in two ways. The first difference is when you pay the cost. The second difference is what stays after the question.

Each system has the same three layers.

Layer 1 is the source documents. These are your articles, papers and repositories. The model reads them. The model does not change them.

Layer 2 is the wiki. The wiki is markdown. The model writes all of the wiki. The wiki contains summaries, pages for each subject, and links between the pages.

Layer 3 is the schema file. This file tells the model the structure of the wiki. It also tells the model which tasks to do. The usual file is CLAUDE.md or AGENTS.md. This file makes the model a correct maintainer of the wiki.

![图像](https://pbs.twimg.com/media/HNwi6rKbsAAvhwh?format=jpg&name=large)

The system does three operations.

Ingest: the model reads a new source. Then the model writes the data to each related page.

Query: you ask the wiki a question. You can write a good answer back into the wiki as a new page.

Lint: the model examines the wiki. It finds information that disagrees. It finds information that is too old. It finds pages with no links.

## Why it works:

Human wikis become incorrect with time. The cause is specific. The difficult part is not to read the sources. The difficult part is not to have the ideas. The difficult part is the maintenance.

The maintenance has these tasks. You must correct the links between the pages. You must keep the summaries correct. You must compare each new document with the pages that exist.

This work does not stop. The work gives no reward. A busy team stops this work first. Then the wiki becomes incorrect. Then the people do not use it.

A model does this work without a problem. The model does not become bored. The model does not forget a link. The model can change fifteen files in one operation.

The idea is old. Vannevar Bush described the Memex in 1945. The Memex is a personal store of documents with links between them. Bush had no answer for the maintenance. The model is the answer.

## Where the name comes from

Read the Karpathy gist directly. It is more accurate than the summaries of it.

He writes this about the usual method: "the LLM is rediscovering knowledge from scratch on every question. There's no accumulation."

His method is to compile the information, and not to retrieve it. Then "the knowledge is compiled once and then kept current, not re-derived on every query." The result is "a persistent, compounding artifact."

You do not write the wiki. He writes: "You never (or rarely) write the wiki yourself, the LLM writes and maintains all of it." He uses the agent and Obsidian together. He writes: "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."

The gist gives a limit for the size. Many summaries do not include this limit. The method without embeddings "works surprisingly well at moderate scale (~100 sources, ~hundreds of pages) and avoids the need for embedding-based RAG infrastructure."

For more sources, the gist tells you to add search. It gives qmd as the example. The gist describes qmd as "a local search engine for markdown files with hybrid BM25/vector search and LLM re-ranking."

Thus the rule is about size. The rule is not about replacement. Do not use retrieval infrastructure when the source set is small. Add retrieval when the source set becomes large.

## What the labs actually built

This is where the pattern stops being an idea and becomes engineering, and the differences between the implementations are the useful part.

**Cognition: DeepWiki, the wiki as a public utility**

Cognition applied the method to the public repositories on GitHub. Replace [github.com](https://github.com/) with [deepwiki.com](https://deepwiki.com/) in the URL of a public repository. You then get a wiki for that codebase. The wiki has an architecture summary, a file index, a dependency graph, and search. The wiki has links to the source (Cognition).

More than 50,000 of the largest public repositories have a wiki. The list includes MCP and LangChain.

The second point is more important. The wiki is not the product. The wiki is retrieval infrastructure for the agent. Devin uses the wiki to find the related code in a codebase. DeepWiki is thus the compiled layer below the code search in Devin (Devin Docs).

**Factory: AutoWiki, documentation as a build artifact**

Factory applied the method to continuous integration. Factory writes that documentation must be a build artifact, and not a separate project. The documentation comes from the source. It has the structure of the codebase. It changes when the repository changes (Factory).

![图像](https://pbs.twimg.com/media/HNwjUyBawAAv6Zm?format=jpg&name=large)

The method to make the wiki has two passes. Pass 1 is a structural scan. It reads the README file, the package manifests, the CI configuration and the entry points. Pass 2 is a semantic scan. It reads the routes, the API endpoints, the service classes, the database schemas and the feature flags.

Factory divides the work between specialized agents. Each agent gets one part of the repository. Each agent gets sufficient context to write one good page. This method prevents a known problem: one agent alone writes poor documentation for a large repository.

Factory keeps the wiki correct with infrastructure, and not with discipline. The /wiki command makes the wiki again. The /install-wiki command writes a CI workflow. This workflow makes the wiki again at each push to the default branch. For GitHub, the wiki goes into the wiki tab of the repository (Factory Docs).

**LangChain: OpenWiki, and the leap from code to everything**

LangChain released OpenWiki as open-source software. OpenWiki is a CLI tool. It writes and maintains agent documentation for a codebase. LangChain then released OpenWiki Brains, which has two modes. Code Brain is the first mode, for a repository. Personal Brain is the second mode, for your own sources (LangChain).

Personal Brain is the important change. It reads data from Gmail, Notion, git repositories, X, Hacker News and web search. It writes all of this data into one local markdown wiki. The agent reads this wiki. The method changed from documentation of a repository to documentation of your work.

Each team made the same decision about the output. The output is not text for a person to read. The output is structured markdown for LLM context. It has headings, links between pages, and summaries. The structure lets an agent find the related information quickly. The reader of the wiki is a model.

**GBrain: the personal-scale open-source version**

GBrain applies the method to a personal knowledge store, and not to a codebase. GBrain uses markdown in a git repository. It has a schema file. It makes a graph of links between subjects automatically.

GBrain shows that the method needs very little infrastructure. It has no vector database. It has no service. It has files. A model maintains the files. A person can read the files.

## The technique matrix

![图像](https://pbs.twimg.com/media/HNwja8_bMAA5BvX?format=jpg&name=large)

The four systems have the same structure. They use markdown in git. They use a schema file. They compile at ingest. They make the wiki again when the sources change. They write the pages for an agent to read. Four teams solved four different problems and made the same structure. This agreement is good evidence that the structure is correct.

The systems are different in maintenance. Factory does the maintenance in CI. The other three systems do the maintenance when a person runs a command. Their wikis are thus only as correct as the last command.

## Where it stops

Limit 1 is size. Karpathy gives this limit. The method without embeddings is correct for approximately 100 sources. For more pages, you must add a search engine. The gist tells you to use BM25 search and vector search together.

Limit 2 is accuracy. The model compiles the information at ingest. An early summary can remove a detail from the source. Each later answer has this error. Retrieval from the raw parts does not have this problem. You exchange the cost of repeated work for the risk of lost data.

Limit 3 is old information. A page is only as correct as the last update. This is the reason that the Factory method is important. An incorrect wiki is worse than no wiki. The incorrect information has the format of correct information.

Limit 4 is cost. You pay tokens to make pages. You can make pages that nobody reads. You also pay tokens to lint pages that did not change.

## A wiki is not memory

There is one difference that you must know. The words in this field are not yet precise.

Many people call these systems memory. LangChain calls OpenWiki a wiki memory layer for AI agents. Other people say that a wiki gives memory to an agent. The word memory has two different meanings here.

![图像](https://pbs.twimg.com/media/HNwjgmraIAAtBRj?format=jpg&name=large)

The first meaning is knowledge of a document set. A wiki does this. It compiles the data in your documents, your repository or your Gmail. It tells you what the documents contain.

The second meaning is memory of a user. This is different data. It includes the preferences of a person. It includes the decisions of a person. It includes the methods that a team rejected. It includes the result when an agent tried a method in a different application.

Memory of a user has a different structure. It is related to a person, and not to a document set. It comes from interaction, and not from ingest. It must also do these tasks for each user: correct information that disagrees, remove information that is too old, keep the source of each item, and delete data on request.

A wiki does the first task correctly. A wiki does not do the second task. Your Gmail wiki tells the agent what is in your Gmail. It does not tell the agent that you changed a decision in a conversation on Tuesday. It does not tell the agent that a method already failed for you.

A memory layer does the second task. Mem0 is an example. It keeps each memory with a user\_id. The memory thus moves with the person between sessions, applications and agents. It changes a fact in position when the fact changes. It does not add a new record each time.

The two systems are not alternatives. Use both. The error is not to use a wiki. The error is to think that a wiki gives you memory of a user.

## Summary

The idea in agent wikis is correct. Compile the knowledge one time. Then keep it correct. Do not build it again for each question. The maintenance stopped human wikis, and a model does the maintenance at no cost. Four teams built the same structure in a few months. This is strong evidence.

Do these three things. Compile your documents into pages when the document set is stable and you read it frequently. Add retrieval when the document set becomes large, as the gist tells you. Keep the difference between knowledge of a document set and memory of a user. A wiki gives you the first. A wiki does not give you the second.

**In Context #17**

This blog is part of In Context, a [@mem0ai](https://x.com/@mem0ai) blog series covering AI Agent memory and context engineering.

Mem0 is an intelligent, open-source memory layer designed for LLMs and AI agents to provide long-term, personalized, and context-aware interactions across sessions.

- Get your free API Key here: [app.mem0.ai](https://app.mem0.ai/?utm_source=x_article_mem0&utm_medium=x_article&utm_campaign=agent_wiki&utm_content=agent_wiki)
- or self-host mem0 from our [open source github repository](https://github.com/mem0ai/mem0)

## References

- [Andrej Karpathy, LLM Wiki (GitHub Gist, April 2026)](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [qmd: local hybrid BM25/vector search for markdown](https://github.com/tobi/qmd)
- [Cognition, DeepWiki: AI docs for any repo](https://cognition.com/blog/deepwiki)
- [Devin Docs, DeepWiki](https://docs.devin.ai/work-with-devin/deepwiki)
- [Factory, Introducing AutoWiki](https://factory.ai/news/wiki)
- [Factory Documentation, AutoWiki overview](https://docs.factory.ai/cli/features/wiki/overview)
- [langchain-ai/openwiki (GitHub)](https://github.com/langchain-ai/openwiki)
- [LangChain, Wiki Memory](https://www.langchain.com/blog/wiki-memory)
- [garrytan/gbrain (GitHub)](https://github.com/garrytan/gbrain)
- [Vannevar Bush, As We May Think (The Atlantic, 1945)](https://www.theatlantic.com/magazine/archive/1945/07/as-we-may-think/303881/)
- [Mem0](https://mem0.ai/)
