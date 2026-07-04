# GCP deployment helpers for apps/mcp. These are documentation/convenience
# targets only — nothing here runs automatically; you invoke `make <target>`
# yourself once GCP_PROJECT_ID/GCP_REGION are set for your own project.
GCP_PROJECT_ID ?=
GCP_REGION ?= us-central1
GCP_REGISTRY_NAME ?= axiomflow
GCP_MCP_SERVICE_NAME ?= axiomflow-mcp

.PHONY: gcp-enable-apis gcp-create-registry build-mcp deploy-mcp show-urls

gcp-enable-apis:
	gcloud services enable \
		run.googleapis.com \
		cloudbuild.googleapis.com \
		artifactregistry.googleapis.com \
		--project=$(GCP_PROJECT_ID)

gcp-create-registry:
	gcloud artifacts repositories create $(GCP_REGISTRY_NAME) \
		--repository-format=docker \
		--location=$(GCP_REGION) \
		--project=$(GCP_PROJECT_ID)

build-mcp:
	gcloud builds submit \
		--config=apps/mcp/build-mcp.yaml \
		--substitutions=_REGION=$(GCP_REGION),_REGISTRY_NAME=$(GCP_REGISTRY_NAME),_SERVICE_NAME=$(GCP_MCP_SERVICE_NAME) \
		--project=$(GCP_PROJECT_ID) \
		.

deploy-mcp: build-mcp

show-urls:
	gcloud run services describe $(GCP_MCP_SERVICE_NAME) \
		--region=$(GCP_REGION) \
		--project=$(GCP_PROJECT_ID) \
		--format='value(status.url)'
