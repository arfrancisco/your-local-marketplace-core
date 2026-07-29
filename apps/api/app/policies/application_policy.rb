# Pundit base policy. Default-deny: every permission is false until a subclass
# opts in. `user` is the authenticated User; `record` is the model under check.
class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    @user = user
    @record = record
  end

  def index?    = false
  def show?     = false
  def create?   = false
  def new?      = create?
  def update?   = false
  def edit?     = update?
  def destroy?  = false

  class Scope
    def initialize(user, scope)
      @user = user
      @scope = scope
    end

    def resolve
      raise NoMethodError, "#{self.class} must implement #resolve"
    end

    private

    attr_reader :user, :scope
  end
end
