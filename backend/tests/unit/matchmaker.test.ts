import { Matchmaker } from '../../src/modules/matchmaker';

describe('Matchmaker', () => {
  let matchmaker: Matchmaker;

  beforeEach(() => {
    matchmaker = new Matchmaker();
  });

  describe('addToQueue', () => {
    it('should add user to matchmaking queue', () => {
      const result = matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pvp',
        skill_rating: 1000,
      });

      expect(result.position).toBe(0);
    });

    it('should update existing entry in queue', () => {
      matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pvp',
        skill_rating: 1000,
      });

      const result = matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pve',
        skill_rating: 1100,
      });

      expect(result.position).toBe(0);
    });
  });

  describe('removeFromQueue', () => {
    it('should remove user from queue', () => {
      matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pvp',
        skill_rating: 1000,
      });

      const removed = matchmaker.removeFromQueue('user1');

      expect(removed).toBe(true);
    });

    it('should return false for non-existent user', () => {
      const removed = matchmaker.removeFromQueue('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('findMatch', () => {
    it('should find match between two queued users', () => {
      matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pvp',
        skill_rating: 1000,
      });

      matchmaker.addToQueue({
        user_id: 'user2',
        preferred_mode: 'pvp',
        skill_rating: 1050,
      });

      const result = matchmaker.findMatch('user1');

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.opponent_id).toBe('user2');
    });

    it('should return null when no suitable match found', () => {
      matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pvp',
        skill_rating: 1000,
      });

      const result = matchmaker.findMatch('user1');

      expect(result).toBeNull();
    });
  });

  describe('getQueuePosition', () => {
    it('should return correct queue position', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 1000 });

      const position = matchmaker.getQueuePosition('user2');

      expect(position).toBe(1);
    });

    it('should return -1 for user not in queue', () => {
      const position = matchmaker.getQueuePosition('nonexistent');

      expect(position).toBe(-1);
    });
  });

  describe('getMatch', () => {
    it('should return match entry', () => {
      const match = matchmaker.createPvPMatch('player1', 'player2');

      const found = matchmaker.getMatch(match.match_id);

      expect(found).not.toBeNull();
      expect(found?.creator_id).toBe('player1');
    });
  });

  describe('createPvPMatch', () => {
    it('should create a PvP match between two players', () => {
      const match = matchmaker.createPvPMatch('player1', 'player2');

      expect(match.status).toBe('active');
      expect(match.mode).toBe('pvp');
      expect(match.creator_id).toBe('player1');
      expect(match.opponent_id).toBe('player2');
    });
  });

  describe('getWaitingCount', () => {
    it('should return correct queue count', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 1000 });

      expect(matchmaker.getWaitingCount()).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty user ID', () => {
      const result = matchmaker.addToQueue({
        user_id: '',
        preferred_mode: 'pvp',
        skill_rating: 1000,
      });

      expect(result.position).toBe(0);
    });

    it('should handle negative skill rating', () => {
      const result = matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pvp',
        skill_rating: -100,
      });

      expect(result.position).toBe(0);
    });

    it('should handle zero skill rating', () => {
      const result = matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pvp',
        skill_rating: 0,
      });

      expect(result.position).toBe(0);
    });

    it('should handle very large skill rating', () => {
      const result = matchmaker.addToQueue({
        user_id: 'user_large_skill',
        preferred_mode: 'pvp',
        skill_rating: 999999,
      });

      expect(result.position).toBe(0);

      const findResult = matchmaker.findMatch('user_large_skill');
      expect(findResult).toBeNull();
    });

    it('should handle PVE mode', () => {
      const result = matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'pve',
        skill_rating: 1000,
      });

      expect(result.position).toBe(0);
    });

    it('should handle campaign mode', () => {
      const result = matchmaker.addToQueue({
        user_id: 'user1',
        preferred_mode: 'campaign',
        skill_rating: 1000,
      });

      expect(result.position).toBe(0);
    });

    it('should update queue position after removal', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.removeFromQueue('user1');

      const position = matchmaker.getQueuePosition('user2');
      expect(position).toBe(0);
    });

    it('should not find match with only one user in queue', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });

      const result = matchmaker.findMatch('user1');
      expect(result).toBeNull();
    });

    it('should match users regardless of mode in findMatch', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pve', skill_rating: 1000 });

      const result = matchmaker.findMatch('user1');
      expect(result).not.toBeNull();
    });

    it('should match users with similar skill ratings', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 1050 });

      const result = matchmaker.findMatch('user1');

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    it('should not match users with skill difference exceeding tolerance', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 2000 });

      const result = matchmaker.findMatch('user1');
      expect(result).toBeNull();
    });

    it('should get match count after creating matches', () => {
      expect(matchmaker.getMatchCount()).toBe(0);

      matchmaker.createPvPMatch('player1', 'player2');
      matchmaker.createPvPMatch('player3', 'player4');

      expect(matchmaker.getMatchCount()).toBe(2);
    });

    it('should handle cancelMatch for non-existent match', () => {
      const result = matchmaker.cancelMatch('nonexistent');
      expect(result).toBe(false);
    });

    it('should handle cancelMatch for active match', () => {
      const match = matchmaker.createPvPMatch('player1', 'player2');
      const result = matchmaker.cancelMatch(match.match_id);

      expect(result).toBe(false);
    });

    it('should return correct queue position after multiple additions', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user3', preferred_mode: 'pvp', skill_rating: 1000 });

      expect(matchmaker.getQueuePosition('user1')).toBe(0);
      expect(matchmaker.getQueuePosition('user2')).toBe(1);
      expect(matchmaker.getQueuePosition('user3')).toBe(2);
    });

    it('should handle duplicate user re-queue', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pve', skill_rating: 1500 });

      expect(matchmaker.getWaitingCount()).toBe(1);
      expect(matchmaker.getQueuePosition('user1')).toBe(0);
    });

    it('should find best match among multiple candidates', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 1010 });
      matchmaker.addToQueue({ user_id: 'user3', preferred_mode: 'pvp', skill_rating: 1150 });

      const result = matchmaker.findMatch('user1');

      expect(result).not.toBeNull();
      expect(result?.opponent_id).toBe('user2');
    });

    it('should remove both users from queue after match', () => {
      matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
      matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 1050 });

      const result = matchmaker.findMatch('user1');

      expect(result).not.toBeNull();
      expect(matchmaker.getWaitingCount()).toBe(0);
    });

    it('should return correct health for opponent after match created', () => {
      const match = matchmaker.createPvPMatch('player1', 'player2');

      const found = matchmaker.getMatch(match.match_id);

      expect(found).not.toBeNull();
      expect(found?.creator_id).toBe('player1');
      expect(found?.opponent_id).toBe('player2');
      expect(found?.mode).toBe('pvp');
      expect(found?.status).toBe('active');
    });

    describe('matchPassesFilter', () => {
      const mockMatch: any = {
        match_id: 'match1',
        creator_id: 'user1',
        opponent_id: 'user2',
        creator_rank: 100,
        opponent_rank: 105,
        match_type: 'ranked',
        status: 'pending',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      it('should exclude own matches', () => {
        const passes = (matchmaker as any).matchPassesFilter(mockMatch, 'user1', {});
        expect(passes).toBe(false);
      });

      it('should exclude non-pending matches', () => {
        const activeMatch = { ...mockMatch, status: 'active' };
        const passes = (matchmaker as any).matchPassesFilter(activeMatch, 'user2', {});
        expect(passes).toBe(false);
      });

      it('should respect match_type filter', () => {
        const passes = (matchmaker as any).matchPassesFilter(
          mockMatch,
          'user2',
          { match_type: 'casual' }
        );
        expect(passes).toBe(false);
      });

      it('should respect min_rank filter', () => {
        const passes = (matchmaker as any).matchPassesFilter(
          mockMatch,
          'user2',
          { min_rank: 150 }
        );
        expect(passes).toBe(false);
      });

      it('should respect max_rank filter', () => {
        const passes = (matchmaker as any).matchPassesFilter(
          mockMatch,
          'user2',
          { max_rank: 50 }
        );
        expect(passes).toBe(false);
      });

      it('should pass with no filters', () => {
        const passes = (matchmaker as any).matchPassesFilter(mockMatch, 'user2', {});
        expect(passes).toBe(true);
      });
    });

    describe('clearQueue', () => {
      it('should clear all queued users', () => {
        matchmaker.addToQueue({ user_id: 'user1', preferred_mode: 'pvp', skill_rating: 1000 });
        matchmaker.addToQueue({ user_id: 'user2', preferred_mode: 'pvp', skill_rating: 1000 });

        matchmaker.clearQueue();

        expect(matchmaker.getWaitingCount()).toBe(0);
        expect(matchmaker.getQueuePosition('user1')).toBe(-1);
        expect(matchmaker.getQueuePosition('user2')).toBe(-1);
      });

      it('should handle empty queue', () => {
        matchmaker.clearQueue();
        expect(matchmaker.getWaitingCount()).toBe(0);
      });
    });

    describe('getMatches', () => {
      it('should return empty array when no matches exist', () => {
        const matches = (matchmaker as any).getMatches('user1');
        expect(matches).toEqual([]);
      });

      it('should return matches excluding user\'s own', () => {
        matchmaker.createPvPMatch('user1', 'user2');
        const matches = (matchmaker as any).getMatches('user1');
        expect(matches).toHaveLength(1);
        expect(matches[0].creator_id).not.toBe('user1');
      });
    });

    describe('cancelMatch', () => {
      it('should cancel pending match', () => {
        const match = matchmaker.createPvPMatch('player1', 'player2');
        const result = matchmaker.cancelMatch(match.match_id);
        expect(result).toBe(true);
      });

      it('should handle cancelling non-existent match', () => {
        const result = matchmaker.cancelMatch('nonexistent');
        expect(result).toBe(false);
      });
    });

    describe('getMatchHistory', () => {
      it('should return empty array initially', () => {
        const history = (matchmaker as any).getMatchHistory('user1');
        expect(history).toEqual([]);
      });

      it('should track completed matches', () => {
        const match = matchmaker.createPvPMatch('player1', 'player2');
        const history = (matchmaker as any).getMatchHistory('player1');
        expect(history).toHaveLength(1);
      });
    });

    describe('updateMatch', () => {
      it('should update match status', () => {
        const match = matchmaker.createPvPMatch('player1', 'player2');
        const result = (matchmaker as any).updateMatch(match.match_id, { status: 'completed' });
        expect(result).toBe(true);

        const updated = matchmaker.getMatch(match.match_id);
        expect(updated?.status).toBe('completed');
      });

      it('should return false for non-existent match', () => {
        const result = (matchmaker as any).updateMatch('nonexistent', { status: 'completed' });
        expect(result).toBe(false);
      });
    });
  });
});
