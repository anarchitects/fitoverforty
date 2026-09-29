import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@fitoverforty/seo-angular';

/**
 * The page that says what this blog is, for a reader who arrived on one post
 * and wants to know whether the rest is worth their time.
 *
 * Static prose rather than anything data-driven. The four pillars are named
 * here in the same fixed order the pillar index uses, but written out rather
 * than fetched: this page is a statement of intent, and a pillar with no posts
 * yet should still appear in it. `/blog/pillars` is the live count.
 *
 * It sits in the blog feature lib beside `not-found.page` — the pages that
 * belong to the site rather than to a route's data — because one static page
 * does not justify a project of its own.
 */
@Component({
  selector: 'fitoverforty-about-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="anx-section blog-about">
      <h1>About</h1>

      <p class="blog-lede">
        Fit Over Forty is a blog about staying in decent shape when you did not
        start yesterday.
      </p>

      <p>
        Most fitness writing assumes a reader with time, an uncomplicated body
        and nothing else to do that day. What actually changes in your forties
        is not your capacity so much as your margin for error. Recovery takes
        longer. A bad week costs more. The things that worked at twenty-five
        stop working without announcing it.
      </p>

      <p>
        So this is a log rather than a programme. Two of us write it, neither of
        us is a coach, and nothing here is prescribed. It is what we tried, what
        happened, and what we would do differently.
      </p>

      <h2>Four kinds of fitness</h2>

      <p>
        Everything here sits under one of four headings. The physical one is
        what people write about, and it is usually the first thing to fail when
        the other three are neglected.
      </p>

      <ul class="blog-about-pillars">
        <li>
          <a routerLink="/blog/pillar/physical-fitness">Physical Fitness</a>
          — training, recovery, and the equipment that survived contact with
          real life.
        </li>
        <li>
          <a routerLink="/blog/pillar/mental-fitness">Mental Fitness</a>
          — attention, sleep, and what we have been reading.
        </li>
        <li>
          <a routerLink="/blog/pillar/emotional-fitness">Emotional Fitness</a>
          — the part nobody puts in a training plan.
        </li>
        <li>
          <a routerLink="/blog/pillar/financial-fitness">Financial Fitness</a>
          — planning far enough ahead that the next thirty years stay a choice.
        </li>
      </ul>

      <h2>What this is not</h2>

      <p>
        It is not medical advice, and we are not qualified to give any. If
        something hurts, or you are starting again after an injury or an illness,
        talk to someone who can examine you. We write about what we did; you
        know things about your own body that we do not.
      </p>

      <p>
        There are no adverts here, no affiliate links, and nothing is sponsored.
        If we mention a piece of equipment it is because we bought it. There is
        no third-party analytics on these pages either — the
        <a routerLink="/privacy">privacy notice</a> sets out exactly what is and
        is not collected.
      </p>

      <h2>Keeping in touch</h2>

      <p>
        New posts go out by email, and only if you confirm the address first.
        You can also <a href="/blog/feed.xml">subscribe by RSS</a>, or
        <a routerLink="/contact">send us a message</a> — we read everything,
        even when it takes us a while to answer.
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPage {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.apply({
      title: 'About',
      description:
        'Who writes Fit Over Forty, what the four pillars are, and what this blog does not claim to be.',
      path: '/about',
    });
  }
}
