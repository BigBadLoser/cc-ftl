import { describe, expect, it } from 'vitest';
import { createBuildBudget } from './buildBudget';

describe('build budget', () => {
  it('lets each gate build its first piece of a frame, then only within the share', () => {
    let t = 0;
    const b = createBuildBudget(() => t);
    const a = b.gate(() => false);
    const c = b.gate(() => false);
    b.frame(5, false);
    t = 10; // the share is spent
    expect(a.take()).toBe(true);
    expect(a.take()).toBe(false);
    expect(c.take()).toBe(true); // every build progresses
    expect(c.take()).toBe(false);
    expect(a.refused).toBe(1);
    a.reset();
    expect(a.refused).toBe(0);
    b.frame(5, false);
    expect(a.take()).toBe(true);
    expect(a.take()).toBe(true); // within the share
  });

  it('never refuses an open gate, nor any gate while rushing', () => {
    let t = 0;
    const b = createBuildBudget(() => t);
    const open = b.gate(() => true);
    const shut = b.gate(() => false);
    b.frame(0, false);
    t = 1;
    for (let i = 0; i < 5; i++) expect(open.take()).toBe(true);
    b.setRush(true);
    for (let i = 0; i < 5; i++) expect(shut.take()).toBe(true);
  });

  it('gives background work only an idle frame share, with no free piece', () => {
    let t = 0;
    const b = createBuildBudget(() => t);
    const idle = b.idle();
    b.frame(5, false);
    expect(idle.take()).toBe(false);
    b.frame(5, true);
    expect(idle.take()).toBe(true);
    t = 10;
    expect(idle.take()).toBe(false);
  });
});
