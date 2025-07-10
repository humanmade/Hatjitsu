# HM Planning Poker

Originally Hatjitsu, create disposable online [Planning Poker](http://en.wikipedia.org/wiki/Planning_poker) rooms for quick and easy estimations.

## Features

* Simple interface
* No login/signup required
* Votes are kept hidden until all have voted to prevent coercion
* 'Observer feature' - watch the planning session without having to vote
* Multiple planning card decks
* Adaptive design allows to work on desktop, tablet and mobile

## Installation

```sh
nvm use
npm install -d
npm start
```

[http://localhost:5099](http://localhost:5099)

## Deployment

To update planning poker:

 - clone the repository using the heroku cli tool
 - add this repo as a `github` remote
 - checkout the github master branch
 - pull down changes, then switch to heroku `main` branch
 - merge `master` into `main` and push. You should see build progress in the `git push` output.
