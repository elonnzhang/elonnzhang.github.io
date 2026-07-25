---
layout: page
title: Archive
---

<section class="archive">
  {% if site.posts[0] %}

    {% capture currentyear %}{{ 'now' | date: "%Y" }}{% endcapture %}
    {% capture firstpostyear %}{{ site.posts[0].date | date: '%Y' }}{% endcapture %}
    {% if currentyear == firstpostyear %}
        <h3>This year's posts</h3>
    {% else %}
        <h3>{{ firstpostyear }}</h3>
    {% endif %}

    {%for post in site.posts %}
      {% unless post.next %}
        <ul class="archive-list">
      {% else %}
        {% capture year %}{{ post.date | date: '%Y' }}{% endcapture %}
        {% capture nyear %}{{ post.next.date | date: '%Y' }}{% endcapture %}
        {% if year != nyear %}
          </ul>
          <h3>{{ post.date | date: '%Y' }}</h3>
          <ul class="archive-list">
        {% endif %}
      {% endunless %}
        <li class="archive-list__item">
          <span class="archive-list__prompt" aria-hidden="true">&gt;</span>
          <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date:"%d %b" }}</time>
          <a href="{{ post.url | prepend: site.baseurl | replace: '//', '/' }}">
            {{ post.title }}
          </a>
        </li>
    {% endfor %}
    </ul>

  {% endif %}
</section>
