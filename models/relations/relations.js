module.exports = function (sequelize, DataTypes) {
  const { User, Role, UserReferral, UserApple, PricingPlan } = sequelize.models;

  Role.hasMany(User, { foreignKey: "role_id" });
  User.belongsTo(Role, { foreignKey: "role_id" });
  User.hasMany(UserReferral, { foreignKey: "id" });
  User.hasOne(UserApple, { foreignKey: "id" });
  UserApple.belongsTo(User, { foreignKey: "userId" });
  UserReferral.hasMany(User, { foreignKey: "senderId" });
  // Relation below made after requirement for adding tickets in plan creation
  PricingPlan.hasMany(Users, { foreignKey: "plan_id" });
};
