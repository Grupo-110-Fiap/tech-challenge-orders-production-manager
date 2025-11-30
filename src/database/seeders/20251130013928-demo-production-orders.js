'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     */
    await queryInterface.bulkInsert('production_orders', [
      {
        id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
        externalOrderId: 'ORDER-001',
        items: JSON.stringify([{ name: 'Hamburguer', quantity: 2 }, { name: 'Coke', quantity: 2 }]),
        status: 'RECEIVED',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'd290f1ee-6c54-4b01-90e6-d701748f0852',
        externalOrderId: 'ORDER-002',
        items: JSON.stringify([{ name: 'Pizza', quantity: 1 }]),
        status: 'PREPARING',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'd290f1ee-6c54-4b01-90e6-d701748f0853',
        externalOrderId: 'ORDER-003',
        items: JSON.stringify([{ name: 'Salad', quantity: 1 }]),
        status: 'DONE',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     */
    await queryInterface.bulkDelete('production_orders', null, {});
  }
};
