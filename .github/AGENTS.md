# GitHub Automation Guide

The workflow in workflows/hugo.yml is the production deployment path.

It must check out the repository, install the pinned Hugo extended version, build go-change-lab with npm ci, copy the result into static/go-change-lab/, build Hugo with --gc --minify, upload public/ as a Pages artifact, and deploy it with GitHub Pages actions.

Keep permissions least-privilege and never add secrets to source files. Verify workflow changes with an equivalent local build where possible.

