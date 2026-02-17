import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { contentDepth } from '../../utils/content-depth.js';

describe('content-depth', () => {
  let handler;

  beforeEach(() => {
    handler = contentDepth.createContentHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects content types present on the page', async () => {
    const page = {
      $$: vi.fn((selector) => {
        const mapping = {
          '[data-testid="videoPlayer"], video, [data-testid="card.layout.media"]': [{}],
          '[data-testid="polls"]': [],
          '[data-testid="tweetPhoto"], [data-testid="card.layout.media"]': [{}],
          'a[href*="http"]': [{}, {}],
          '[data-testid="tweetThread"]': []
        };
        return mapping[selector] ?? [];
      })
    };

    const types = await handler.detectContentType(page);
    expect(types).toEqual(expect.arrayContaining(['video', 'image', 'link']));
    expect(types).not.toContain('poll');
    expect(types).not.toContain('thread');
  });

  it('skips video engagement when random threshold is not met', async () => {
    const page = {
      $: vi.fn().mockResolvedValue({ click: vi.fn() }),
      waitForTimeout: vi.fn(),
      keyboard: { press: vi.fn() }
    };
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await handler.engageWithVideo(page, { logger });

    expect(result).toEqual({ success: true, action: 'skipped' });
    expect(logger.info).toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('returns no_video when video is missing', async () => {
    const page = { $: vi.fn().mockResolvedValue(null) };
    const result = await handler.engageWithVideo(page);
    expect(result).toEqual({ success: false, reason: 'no_video' });
  });

  it('handles video engagement errors', async () => {
    const page = {
      $: vi.fn().mockResolvedValue({ click: vi.fn() }),
      waitForTimeout: vi.fn(),
      keyboard: { press: vi.fn() }
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await handler.engageWithVideo(page, { logger });

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('participates in a poll when options are available', async () => {
    const optionClick = vi.fn();
    const poll = {
      $$: vi.fn().mockResolvedValue([{ click: vi.fn() }, { click: optionClick }])
    };
    const page = {
      $: vi.fn().mockResolvedValue(poll),
      waitForTimeout: vi.fn()
    };
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.6);
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await handler.participateInPoll(page, { logger });

    expect(result).toEqual({ success: true, action: 'voted', option: 2 });
    expect(optionClick).toHaveBeenCalled();
  });

  it('returns no_poll when no poll is found', async () => {
    const page = { $: vi.fn().mockResolvedValue(null) };
    const result = await handler.participateInPoll(page);
    expect(result).toEqual({ success: false, reason: 'no_poll' });
  });

  it('returns no_options when poll has no options', async () => {
    const poll = { $$: vi.fn().mockResolvedValue([]) };
    const page = { $: vi.fn().mockResolvedValue(poll) };
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const result = await handler.participateInPoll(page);

    expect(result).toEqual({ success: false, reason: 'no_options' });
  });

  it('skips image expansion when random threshold is not met', async () => {
    const page = { $: vi.fn().mockResolvedValue({ click: vi.fn() }) };
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await handler.expandImage(page, { logger });

    expect(result).toEqual({ success: true, action: 'skipped' });
    expect(logger.info).toHaveBeenCalled();
  });

  it('handles image expansion errors', async () => {
    const page = {
      $: vi.fn().mockResolvedValue({ click: vi.fn() }),
      waitForTimeout: vi.fn(),
      keyboard: { press: vi.fn() }
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await handler.expandImage(page, { logger });

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('copies link when available', async () => {
    const shareBtn = { click: vi.fn() };
    const copyOption = { click: vi.fn() };
    const page = {
      $: vi.fn((selector) => {
        if (selector === '[aria-label="Share post"]') return Promise.resolve(shareBtn);
        if (selector === 'text="Copy link"') return Promise.resolve(copyOption);
        return Promise.resolve(null);
      }),
      waitForTimeout: vi.fn(),
      keyboard: { press: vi.fn() }
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await handler.copyLink(page, { logger });

    expect(result).toEqual({ success: true, action: 'copied' });
    expect(copyOption.click).toHaveBeenCalled();
  });

  it('returns copy_option_not_found when copy option is missing', async () => {
    const shareBtn = { click: vi.fn() };
    const page = {
      $: vi.fn((selector) => (selector === '[aria-label="Share post"]' ? Promise.resolve(shareBtn) : Promise.resolve(null))),
      waitForTimeout: vi.fn(),
      keyboard: { press: vi.fn() }
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const result = await handler.copyLink(page);

    expect(result).toEqual({ success: false, reason: 'copy_option_not_found' });
    expect(page.keyboard.press).toHaveBeenCalledWith('Escape');
  });

  it('returns no_share_button when share button is missing', async () => {
    const page = { $: vi.fn().mockResolvedValue(null) };
    const result = await handler.copyLink(page);
    expect(result).toEqual({ success: false, reason: 'no_share_button' });
  });

  it('engages with detected content types and returns actions', async () => {
    const page = {
      $$: vi.fn((selector) => {
        if (selector === '[data-testid="videoPlayer"], video, [data-testid="card.layout.media"]') return [{}];
        if (selector === '[data-testid="polls"]') return [{}];
        if (selector === '[data-testid="tweetPhoto"], [data-testid="card.layout.media"]') return [];
        if (selector === 'a[href*="http"]') return [{}];
        if (selector === '[data-testid="tweetThread"]') return [];
        return [];
      })
    };
    const logger = { info: vi.fn() };
    vi.spyOn(handler, 'engageWithVideo').mockResolvedValue({ success: true, action: 'watched' });
    vi.spyOn(handler, 'participateInPoll').mockResolvedValue({ success: false, reason: 'no_options' });
    vi.spyOn(handler, 'copyLink').mockResolvedValue({ success: true, action: 'copied' });

    const result = await handler.engageWithContent(page, { logger });

    expect(result.success).toBe(true);
    expect(result.contentTypes).toEqual(expect.arrayContaining(['video', 'poll', 'link']));
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'video', action: 'watched' }),
      expect.objectContaining({ type: 'link', action: 'copied' })
    ]));
  });

  it('returns no_media when media is missing', async () => {
    const page = { $: vi.fn().mockResolvedValue(null) };
    const result = await handler.viewMedia(page);
    expect(result).toEqual({ success: false, reason: 'no_media' });
  });

  it('handles media view errors', async () => {
    const page = {
      $: vi.fn().mockResolvedValue({ click: vi.fn() }),
      waitForTimeout: vi.fn(),
      keyboard: { press: vi.fn() }
    };
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await handler.viewMedia(page, { logger });

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });
});
