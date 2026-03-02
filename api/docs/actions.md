# Actions

The actions module provides Twitter-specific automation functions for likes, retweets, follows, quotes, replies, and bookmarks.

## Table of Contents

- [Overview](#overview)
- [Like](#like)
- [Retweet](#retweet)
- [Follow](#follow)
- [Quote](#quote)
- [Reply](#reply)
- [Bookmark](#bookmark)
- [AI Actions](#ai-actions)
- [Navigation](#navigation)

---

## Overview

The actions module contains both basic and AI-powered functions for interacting with Twitter. Basic functions use direct selectors, while AI functions use natural language processing.

### Module Structure

```
api/actions/
├── like.js           # Basic like
├── retweet.js        # Basic retweet
├── follow.js         # Basic follow
├── quote.js          # Basic quote
├── reply.js          # Basic reply
├── bookmark.js       # Basic bookmark
├── ai-twitter-like.js      # AI-powered like
├── ai-twitter-retweet.js   # AI-powered retweet
├── ai-twitter-follow.js    # AI-powered follow
├── ai-twitter-quote.js     # AI-powered quote
├── ai-twitter-reply.js     # AI-powered reply
├── ai-twitter-bookmark.js  # AI-powered bookmark
└── advanced-index.js       # Advanced action index
```

---

## Like

Like a tweet.

### Functions

| Function | Description |
|----------|-------------|
| `likeWithAPI(selector)` | Like via API |
| `like(selector)` | Like via UI |

### Usage

```javascript
// Basic like
await api.like('[data-testid="like"]');

// Like via API
await api.likeWithAPI(tweetId);
```

---

## Retweet

Retweet a tweet.

### Functions

| Function | Description |
|----------|-------------|
| `retweetWithAPI(selector)` | Retweet via API |
| `retweet(selector)` | Retweet via UI |

### Usage

```javascript
// Basic retweet
await api.retweet('[data-testid="retweet"]');

// Retweet via API
await api.retweetWithAPI(tweetId);
```

---

## Follow

Follow a user.

### Functions

| Function | Description |
|----------|-------------|
| `followWithAPI(userId)` | Follow via API |
| `follow(selector)` | Follow via UI |

### Usage

```javascript
// Basic follow
await api.follow('[data-testid="follow"]');

// Follow via API
await api.followWithAPI('user-id');
```

---

## Quote

Quote tweet with additional text.

### Functions

| Function | Description |
|----------|-------------|
| `quote(tweetSelector, text)` | Quote tweet |
| `quoteWithAI(tweetSelector, context)` | Quote with AI-generated text |

### Usage

```javascript
// Basic quote
await api.quote('[data-testid="tweet"]', 'Great post!');

// AI-powered quote
await api.quoteWithAI('[data-testid="tweet"]', {
    topic: 'AI',
    sentiment: 'positive'
});
```

---

## Reply

Reply to a tweet.

### Functions

| Function | Description |
|----------|-------------|
| `reply(tweetSelector, text)` | Reply to tweet |
| `replyWithAI(tweetSelector, context)` | Reply with AI-generated text |

### Usage

```javascript
// Basic reply
await api.reply('[data-testid="reply"]', 'Thanks for sharing!');

// AI-powered reply
await api.replyWithAI('[data-testid="reply"]', {
    topic: 'technology',
    tone: 'professional'
});
```

---

## Bookmark

Bookmark a tweet.

### Functions

| Function | Description |
|----------|-------------|
| `bookmarkWithAPI(tweetId)` | Bookmark via API |
| `bookmark(selector)` | Bookmark via UI |

### Usage

```javascript
// Basic bookmark
await api.bookmark('[data-testid="bookmark"]');

// Bookmark via API
await api.bookmarkWithAPI(tweetId);
```

---

## AI Actions

AI-powered actions that generate contextual content.

### Functions

| Function | Description |
|----------|-------------|
| `ai-twitter-like.js` | AI-powered liking |
| `ai-twitter-retweet.js` | AI-powered retweeting |
| `ai-twitter-follow.js` | AI-powered following |
| `ai-twitter-quote.js` | AI-powered quoting |
| `ai-twitter-reply.js` | AI-powered replying |
| `ai-twitter-bookmark.js` | AI-powered bookmarking |

### AI Action Options

```javascript
{
    topic: 'technology',      // Topic context
    tone: 'professional',   // Tone: 'professional', 'casual', 'humorous'
    length: 'medium',       // Length: 'short', 'medium', 'long'
    includeEmoji: true,    // Include emoji
    hashtags: true,        // Include relevant hashtags
    sentiment: 'positive'  // Sentiment: 'positive', 'neutral', 'negative'
}
```

### Usage

```javascript
// AI-powered reply
await api.replyWithAI('[data-testid="reply"]', {
    topic: 'AI news',
    tone: 'professional',
    length: 'medium'
});

// AI-powered quote
await api.quoteWithAI('[data-testid="tweet"]', {
    topic: 'tech',
    sentiment: 'positive',
    includeEmoji: true
});
```

---

## Navigation

Twitter-specific navigation functions.

### Functions

| Function | Description |
|----------|-------------|
| `goHome()` | Navigate to home timeline |
| `goToProfile(username)` | Navigate to profile |
| `goToNotifications()` | Navigate to notifications |
| `goToMessages()` | Navigate to messages |

### Usage

```javascript
// Go home
await api.goHome();

// Go to profile
await api.goToProfile('elonmusk');

// Go to notifications
await api.goToNotifications();
```
