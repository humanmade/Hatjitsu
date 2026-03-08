/*jslint indent: 2, browser: true */
/*global _ */

'use strict';

/* Vote math — framework-agnostic */

function average(data) {
  var sum = data.reduce(function (sum, value) {
    return sum + parseInt(value);
  }, 0);

  var avg = sum / data.length;
  return avg;
}

function standardDeviation(values) {
  var avg = average(values);

  var squareDiffs = values.map(function (value) {
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });

  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

/**
 * Pure vote computation — no framework dependencies.
 *
 * @param {Array}   votes        Array of vote objects with .vote property
 * @param {number}  voterCount   Number of voters in the room
 * @param {boolean} forcedReveal Whether reveal has been forced
 * @returns {object} Computed vote results
 */
function computeVoteResults(votes, voterCount, forcedReveal) {
  var voteCount = votes.length;

  var validVotes = _.filter(_.pluck(votes, 'vote'), function (vote) {
    return !isNaN(parseFloat(vote));
  });

  var placeholderCount = Math.max(0, voterCount - voteCount);
  var showAverage = placeholderCount === 0;

  var votingAverage = 0;
  var votingTotal = 0;
  var votingStandardDeviation = 0;

  if (validVotes.length > 0) {
    var total = _.reduce(_.map(validVotes, parseFloat), function (a, b) { return a + b; }, 0);
    votingAverage = Math.round(total / validVotes.length);
    votingTotal = total;
    votingStandardDeviation = standardDeviation(validVotes);
  }

  var forceRevealDisable = (forcedReveal || (votes.length === voterCount && voterCount > 0));

  var allVotesCast = voterCount > 0 && votes.length === voterCount && _.every(votes, function (v) {
    return v.vote !== undefined && v.vote !== null;
  });

  var voteStatus = 'unfinished';
  if (allVotesCast || forcedReveal) {
    var uniqVotes = _.chain(votes).pluck('vote').uniq().value().length;
    if (uniqVotes === 1) {
      voteStatus = 'unanimous';
    } else if (uniqVotes === voterCount) {
      voteStatus = 'problem';
    } else if (voterCount > 3 && uniqVotes === (voterCount - 1)) {
      voteStatus = 'problem';
    } else {
      voteStatus = 'not_unanimous';
    }
  }

  return {
    validVotes: validVotes,
    average: votingAverage,
    total: votingTotal,
    stddev: votingStandardDeviation,
    placeholderCount: placeholderCount,
    showAverage: showAverage,
    forceRevealDisable: forceRevealDisable,
    voteStatus: voteStatus
  };
}
