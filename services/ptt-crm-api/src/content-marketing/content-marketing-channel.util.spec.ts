import { BadRequestException } from '@nestjs/common';
import {
  assertValidChannelFormat,
  isValidChannelFormat,
  listFormatsForChannel,
} from './content-marketing-channel.util';

describe('content-marketing-channel.util', () => {
  it('accepts facebook + social_post', () => {
    expect(isValidChannelFormat('facebook', 'social_post')).toBe(true);
    expect(() => assertValidChannelFormat('facebook', 'social_post')).not.toThrow();
  });

  it('rejects facebook + blog', () => {
    expect(isValidChannelFormat('facebook', 'blog')).toBe(false);
    expect(() => assertValidChannelFormat('facebook', 'blog')).toThrow(BadRequestException);
  });

  it('accepts website + blog', () => {
    expect(isValidChannelFormat('website', 'blog')).toBe(true);
  });

  it('lists formats for linkedin', () => {
    expect(listFormatsForChannel('linkedin')).toEqual(['social_post', 'carousel']);
  });
});
