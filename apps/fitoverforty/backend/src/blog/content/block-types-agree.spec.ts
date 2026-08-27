import { SUPPORTED_BLOCK_TYPES as CANONICAL } from '@fitoverforty/content-model';
import { SUPPORTED_BLOCK_TYPES as VALIDATOR_HANDLES } from './blocks';

/**
 * The validator and the shared contract must agree.
 *
 * These two lists are read by different people at different times: the
 * contract is what the editor's tool registry offers an author, and this one
 * is what the server will actually accept. When they disagree in the direction
 * of "the editor offers more than the server takes", the failure lands on
 * whoever just wrote a post — they find out at save time that the thing they
 * spent an hour on cannot be stored.
 *
 * There is no runtime coupling between them on purpose: the validator's map is
 * where the sanitising logic lives, and making it derive its keys from the
 * contract would let a type be listed with no handler behind it. So they are
 * kept separate and compared here instead.
 */
describe('supported block types', () => {
  it('the validator handles exactly what the contract promises', () => {
    expect([...VALIDATOR_HANDLES].sort()).toEqual([...CANONICAL].sort());
  });
});
