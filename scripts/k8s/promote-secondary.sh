#!/usr/bin/env bash
set -euo pipefail

kubectl_cmd="${KUBECTL:-kubectl}"
primary_namespace="${PRIMARY_NAMESPACE:-cars-project-c7350da1b9bf4738a4fa7646eef8285f}"
primary_deployment="${PRIMARY_DEPLOYMENT:-cars-project-c7350da1b9bf4738a4fa7646-deployment}"
secondary_namespace="${SECONDARY_NAMESPACE:-metanet-apps-overlay-secondary}"
secondary_deployment="${SECONDARY_DEPLOYMENT:-apps-overlay-secondary}"

${kubectl_cmd} -n "${primary_namespace}" rollout status "deployment/${primary_deployment}" --timeout=15m
primary_image="${PRIMARY_IMAGE:-$(${kubectl_cmd} -n "${primary_namespace}" get deployment "${primary_deployment}" -o jsonpath='{.spec.template.spec.containers[0].image}')}"
${kubectl_cmd} -n "${secondary_namespace}" set image "deployment/${secondary_deployment}" "overlay=${primary_image}" --record=false
${kubectl_cmd} -n "${secondary_namespace}" set image "deployment/${secondary_deployment}" "prepare-runtime=${primary_image}" --record=false
${kubectl_cmd} -n "${secondary_namespace}" rollout status "deployment/${secondary_deployment}" --timeout=15m
${kubectl_cmd} -n "${secondary_namespace}" run "apps-overlay-smoke-$(date +%s)" \
  --quiet --rm -i --restart=Never --image=curlimages/curl:8.11.1 \
  --command -- sh -ec 'curl -fsS http://apps-overlay-secondary:8080/health'

printf 'Secondary Apps overlay promoted to %s\n' "${primary_image}"
