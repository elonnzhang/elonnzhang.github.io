# Data Guide

Structured data in this directory is consumed by Hugo templates.

- site.yaml defines the terminal spaces used by the Header.
- Keep space names stable because they are displayed in the prompt and used by navigation state.
- Prefer small, explicit YAML values over duplicating content already stored in content/.
- When changing a URL here, update the matching page and verify the generated navigation.
