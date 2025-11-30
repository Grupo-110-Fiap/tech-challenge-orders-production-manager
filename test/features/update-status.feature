Feature: Update Production Order Status

  Scenario: Update status to PREPARING
    Given a production order with status "RECEIVED" exists
    When I request to update the status to "PREPARING"
    Then the order status should be "PREPARING"
