import { describe, it, assert } from 'vitest';
import { Document, Text } from '@yorkie-js/sdk/src/yorkie';
import { TimeTicket } from '@yorkie-js/sdk/src/document/time/ticket';

describe('Text.canDeleteForTest', function () {
  it('should understand text structure', function () {
    const doc = new Document<{ k1: Text }>('test-doc');
    
    // Initialize text with separate characters
    doc.update((root) => {
      root.k1 = new Text();
      root.k1.edit(0, 0, 'A');
      root.k1.edit(1, 1, 'B');
      root.k1.edit(2, 2, 'C');
      root.k1.edit(3, 3, 'D');
    }, 'set text');
    
    assert.equal(doc.getRoot().k1.toString(), 'ABCD');
    
    // Get current time ticket and lamport for testing
    const changeID = doc.getChangeID();
    const currentTicket = TimeTicket.of(
      changeID.getLamport() + 1n,
      0,
      changeID.getActorID()
    );
    const clientLamport = changeID.getLamport();
    
    // Test canDelete for all nodes (should all be deletable)
    doc.update((root) => {
      const canDeleteResults = root.k1.canDeleteForTest(0, 4, currentTicket, clientLamport);
      
      // Should have 4 separate nodes since we inserted them separately
      console.log('canDeleteResults length:', canDeleteResults.length);
      console.log('canDeleteResults:', canDeleteResults);
      
      assert.equal(canDeleteResults.length, 4, 'Should have 4 nodes');
      for (let i = 0; i < canDeleteResults.length; i++) {
        assert.isTrue(canDeleteResults[i], `Node at index ${i} should be deletable`);
      }
    });
  });

  it('should check canDelete for nodes in text', function () {
    const doc = new Document<{ k1: Text }>('test-doc');
    
    // Initialize text with "ABCD" as one operation - this creates a single node
    doc.update((root) => {
      root.k1 = new Text();
      root.k1.edit(0, 0, 'ABCD');
    }, 'set text');
    
    assert.equal(doc.getRoot().k1.toString(), 'ABCD');
    
    // Get current time ticket and lamport for testing
    const changeID = doc.getChangeID();
    const currentTicket = TimeTicket.of(
      changeID.getLamport() + 1n,
      0,
      changeID.getActorID()
    );
    const clientLamport = changeID.getLamport();
    
    // Test canDelete for all nodes
    doc.update((root) => {
      const canDeleteResults = root.k1.canDeleteForTest(0, 4, currentTicket, clientLamport);
      
      // When "ABCD" is inserted as one operation, it's stored as a single node
      console.log('Single insert - canDeleteResults length:', canDeleteResults.length);
      console.log('Single insert - canDeleteResults:', canDeleteResults);
      
      // Should have 1 node containing "ABCD"
      assert.equal(canDeleteResults.length, 1, 'Should have 1 node');
      assert.isTrue(canDeleteResults[0], 'Node should be deletable');
    });
    
    // Delete "BC" (index 1-3)
    doc.update((root) => {
      root.k1.edit(1, 3, '');
    }, 'delete BC');
    
    assert.equal(doc.getRoot().k1.toString(), 'AD');
    
    // Test canDelete after deletion
    doc.update((root) => {
      const newChangeID = doc.getChangeID();
      const newTicket = TimeTicket.of(
        newChangeID.getLamport() + 1n,
        0,
        newChangeID.getActorID()
      );
      const newClientLamport = newChangeID.getLamport();
      
      // Check remaining nodes (should be deletable)
      const canDeleteResults = root.k1.canDeleteForTest(0, 2, newTicket, newClientLamport);
      
      console.log('After delete - canDeleteResults length:', canDeleteResults.length);
      console.log('After delete - canDeleteResults:', canDeleteResults);
      
      // After deleting "BC", we should have 2 nodes: "A" and "D"
      assert.equal(canDeleteResults.length, 2, 'Should have 2 nodes');
      assert.isTrue(canDeleteResults[0], 'Node "A" should be deletable');
      assert.isTrue(canDeleteResults[1], 'Node "D" should be deletable');
    });
  });

  it('should handle canDelete with different client lamports', function () {
    const doc = new Document<{ k1: Text }>('test-doc');
    
    // Initialize text with separate inserts
    doc.update((root) => {
      root.k1 = new Text();
      root.k1.edit(0, 0, 'A');
      root.k1.edit(1, 1, 'B');
      root.k1.edit(2, 2, 'C');
    }, 'set text');
    
    // Simulate checking with an older client lamport (before the text was created)
    doc.update((root) => {
      const currentTicket = TimeTicket.of(0n, 0, 'test-actor');
      const oldClientLamport = 0n;
      
      // With old lamport, nodes created later should not be deletable
      const canDeleteResults = root.k1.canDeleteForTest(0, 3, currentTicket, oldClientLamport);
      
      console.log('Old lamport - canDeleteResults length:', canDeleteResults.length);
      console.log('Old lamport - canDeleteResults:', canDeleteResults);
      
      // Nodes should not be deletable with old lamport
      assert.equal(canDeleteResults.length, 3, 'Should have 3 nodes');
      for (let i = 0; i < canDeleteResults.length; i++) {
        assert.isFalse(canDeleteResults[i], `Node at index ${i} should not be deletable with old lamport`);
      }
    });
    
    // Check with current lamport
    doc.update((root) => {
      const changeID = doc.getChangeID();
      const currentTicket = TimeTicket.of(
        changeID.getLamport() + 1n,
        0,
        changeID.getActorID()
      );
      const currentLamport = changeID.getLamport();
      
      // With current lamport, nodes should be deletable
      const canDeleteResults = root.k1.canDeleteForTest(0, 3, currentTicket, currentLamport);
      
      console.log('Current lamport - canDeleteResults length:', canDeleteResults.length);
      console.log('Current lamport - canDeleteResults:', canDeleteResults);
      
      assert.equal(canDeleteResults.length, 3, 'Should have 3 nodes');
      for (let i = 0; i < canDeleteResults.length; i++) {
        assert.isTrue(canDeleteResults[i], `Node at index ${i} should be deletable with current lamport`);
      }
    });
  });

  it('should handle canDelete for already deleted nodes', function () {
    const doc = new Document<{ k1: Text }>('test-doc');
    
    // Initialize text with separate inserts
    doc.update((root) => {
      root.k1 = new Text();
      root.k1.edit(0, 0, 'A');
      root.k1.edit(1, 1, 'B');
      root.k1.edit(2, 2, 'C');
      root.k1.edit(3, 3, 'D');
    }, 'set text');
    
    // Delete "BC" (index 1-3)
    doc.update((root) => {
      root.k1.edit(1, 3, '');
    }, 'delete BC');
    
    assert.equal(doc.getRoot().k1.toString(), 'AD');
    
    // Try to check canDelete with a ticket that's before the deletion
    // This simulates checking if already deleted nodes can be deleted
    doc.update((root) => {
      const changeID = doc.getChangeID();
      // Use a ticket that's earlier than the deletion
      const earlyTicket = TimeTicket.of(1n, 0, changeID.getActorID());
      const earlyLamport = 1n;
      
      // Check the remaining nodes with early ticket
      // They should not be deletable because they were created after the early lamport
      const canDeleteResults = root.k1.canDeleteForTest(0, 2, earlyTicket, earlyLamport);
      
      console.log('Early ticket - canDeleteResults length:', canDeleteResults.length);
      console.log('Early ticket - canDeleteResults:', canDeleteResults);
      
      // With early lamport, current nodes might not be deletable
      assert.equal(canDeleteResults.length, 2, 'Should have 2 nodes');
    });
  });
});