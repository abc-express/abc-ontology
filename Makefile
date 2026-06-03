.PHONY: install build test dev-gateway go-test rust-test compose-up validate-config

install:
	pnpm install

build:
	pnpm run build
	go work sync
	cargo build --workspace

test:
	pnpm run test
	pnpm run test:repo
	go test ./collect-sensing/... ./security-governance/authn/... -count=1
	cargo test --workspace
	python3 -m unittest discover -s toolchain/sdk/python/tests -p 'test_*.py'

dev-gateway:
	pnpm run dev:gateway

go-test:
	go test ./collect-sensing/... -count=1

rust-test:
	cargo test --workspace

compose-up:
	docker compose -f deployment/docker/compose.dev.yaml up -d

validate-config:
	pnpm run validate-config
