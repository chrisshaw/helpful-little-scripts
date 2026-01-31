import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countWords } from "./countWords";

describe("countWords", () => {
  it("counts plain words", () => {
    assert.equal(countWords("hello world"), 2);
  });

  it("returns 0 for empty string", () => {
    assert.equal(countWords(""), 0);
  });

  it("returns 0 for whitespace-only string", () => {
    assert.equal(countWords("   \n\t  "), 0);
  });

  it("counts words in prose with citations, references, and special punctuation", () => {
    const text = `Low-income middle and high school students in the United States lack access to high-quality, on-demand academic support. That is 12 million kids each year who start up to 70% behind peers with wealthier parents [1]. Imagine the lost opportunity for this country.

When low-income students need help with math, they often turn to non-educational resources like YouTube, TikTok, and ChatGPT, tools that provide answers but don't build understanding. High-quality tutoring remains out of reach due to cost, scheduling, and availability constraints.

You'd think a wave of new AI tutors would close this access gap. But after scaling a national marketplace of free volunteer tutors, we've identified two unsolved issues. First, while we're excited by AI's potential, it isn't ready for low-income students today, and students need help yesterday. Second, and most important: even with a river of AI, no one can get the metaphorical horse to drink. Kids already at Harvard do great with AI. Our kids don't care about your Learning Mode.

[1]: Reber & Reeves (2023) of the Brookings Institute found academic preparation accounted for 71% of the college enrollment gap, which corroborates Mcfarland et al (2019) of the NCES. Chingos et al. (2020) of the Urban Institute found it contributed to 45% of the graduation gap.`;

    assert.equal(countWords(text), 208);
  });
});
