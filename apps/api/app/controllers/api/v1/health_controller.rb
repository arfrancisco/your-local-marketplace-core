module Api
  module V1
    # Lightweight readiness check for the API namespace. Confirms the database is
    # reachable so a load balancer can tell "process is up" from "process is up
    # but can't serve requests". Rails' own /up only checks that boot succeeded.
    class HealthController < ApplicationController
      def show
        ActiveRecord::Base.connection.execute("SELECT 1")
        render json: { status: "ok", time: Time.current.iso8601 }
      rescue StandardError => e
        render json: { status: "error", message: e.message }, status: :service_unavailable
      end
    end
  end
end
