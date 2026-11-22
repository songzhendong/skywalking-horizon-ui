<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements.  See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->
# DolphinScheduler

The **DOLPHINSCHEDULER** layer monitors [Apache DolphinScheduler](https://dolphinscheduler.apache.org/) clusters. OAP ingests DolphinScheduler Prometheus metrics via an OpenTelemetry Collector (Prometheus scrape → OTLP) and presents each monitored deployment as a cluster, so this layer is where you watch workflow and task health, Master / Worker pressure, API traffic, and Alert delivery.

In Horizon's sidebar this layer is named **DolphinScheduler**, grouped under **Workflow Scheduler** (alongside Airflow). Its services are listed as **DolphinScheduler clusters** and the processes that report into each cluster (Master, Worker, API, Alert) are listed as **Components**. The DOLPHINSCHEDULER layer enables only the **Service** and **Instance** scopes — there is no endpoint scope, no topology, and no traces or logs tab, because DolphinScheduler's telemetry is component-level meter data rather than request traffic.

This page is the **operator reference** for the bundled DOLPHINSCHEDULER dashboard: what you see on each scope and what each widget means.

> The widgets and metrics below are read from the bundled DOLPHINSCHEDULER template; if an operator has published a customized DOLPHINSCHEDULER template to OAP, the live dashboard reflects that copy instead. See [Layer Dashboard Templates](../customization/layer-templates.md) for how the bundled default, your local draft, and the OAP-published copy relate.

## Service list

Before opening a cluster, the layer landing page lists every DolphinScheduler cluster with four sortable columns, sorted by **Running Workflows** by default:

- **Running Workflows** — running workflow instances across the cluster (`meter_dolphinscheduler_workflow_instance_running`).

- **Prepared Tasks** — tasks prepared for the execution queue (`meter_dolphinscheduler_task_prepared`).

- **Active Worker Tasks** — active execute threads summed across workers (`meter_dolphinscheduler_worker_active_execute_thread`).

- **Task Failures / min** — failed task instances per minute (`meter_dolphinscheduler_task_fail_count`).

## Service dashboard

The primary drill-down for one selected DolphinScheduler cluster. It opens with four single-value cards reporting current cluster load, then time-series charts for task / workflow outcomes, dispatch, execution latency, and command / submit pressure.

**Cards (current value)**

- **Running Workflows** — running workflow instances (`latest(meter_dolphinscheduler_workflow_instance_running)`).

- **Prepared Tasks** — tasks prepared for execution (`latest(meter_dolphinscheduler_task_prepared)`).

- **Active Worker Tasks** — active worker execute threads (`latest(meter_dolphinscheduler_worker_active_execute_thread)`).

- **Task Failures / min** — failed task instances per minute (`latest(meter_dolphinscheduler_task_fail_count)`).

**Charts (over time)**

- **Task Success / Fail / Timeout** — task instance outcomes per minute (`meter_dolphinscheduler_task_success_count`, `meter_dolphinscheduler_task_fail_count`, `meter_dolphinscheduler_task_timeout_count`).

- **Workflow Success / Fail** — workflow instance outcomes per minute (`meter_dolphinscheduler_workflow_success_count`, `meter_dolphinscheduler_workflow_fail_count`).

- **Task Dispatch / Failure / Error** — Master→Worker dispatch per minute (`meter_dolphinscheduler_task_dispatch_count`, `meter_dolphinscheduler_task_dispatch_failure_count`, `meter_dolphinscheduler_task_dispatch_error_count`).

- **Task Execution Duration p99 (ms)** — task execution latency percentile (`meter_dolphinscheduler_task_execution_duration_percentile{p='99'}`).

- **Commands Created / Workflow Submit** — workflow commands created and instances submitted per minute (`meter_dolphinscheduler_workflow_create_command_count`, `meter_dolphinscheduler_workflow_instance_submit_count`).

## Instance dashboard

For one selected **Component** of the cluster. DolphinScheduler reports different meters from different processes — Master (overload, command consume, failover, RPC), Worker (load, capacity, back-pressure), API (request / response / latency), and Alert (send / pending) — so each widget appears only when that component actually reports the metric behind it.

**Master component**

- **Master Overload** — overload events per minute (`meter_dolphinscheduler_instance_master_overload_count`).

- **Commands Consumed** — commands consumed per minute (`meter_dolphinscheduler_instance_master_consume_command_count`).

- **Failover Check Count** — scheduler failover checks per minute (`meter_dolphinscheduler_instance_master_scheduler_failover_check_count`).

- **Failover Check Duration p99 (ms)** — failover check latency (`meter_dolphinscheduler_instance_master_scheduler_failover_check_time_percentile{p='99'}`).

- **RPC Exception** — sync RPC client exceptions per minute (`meter_dolphinscheduler_instance_rpc_client_sync_request_exception_count`).

- **RPC Duration p99 (ms)** — sync RPC latency (`meter_dolphinscheduler_instance_rpc_client_sync_request_duration_percentile{p='99'}`).

**Worker component**

- **Worker Tasks / Queue / Active Threads** — worker load (`meter_dolphinscheduler_instance_worker_task`, `meter_dolphinscheduler_instance_worker_execute_queue_size`, `meter_dolphinscheduler_instance_worker_active_execute_thread`).

- **Worker CPU / Memory Usage / Available** — CPU/memory usage as percent (OAP MAL stores `* 100`) and memory available in GB (`meter_dolphinscheduler_instance_worker_cpu_usage`, `meter_dolphinscheduler_instance_worker_memory_usage`, `meter_dolphinscheduler_instance_worker_memory_available/100`).

- **Worker Overload / Full Submit Queue** — back-pressure per minute (`meter_dolphinscheduler_instance_worker_overload_count`, `meter_dolphinscheduler_instance_worker_full_submit_queue_count`). Gated on `worker_task` so overload-only or queue-only workers still show the panel.

**API component**

- **API Request / Response** — request and response counts per minute (`meter_dolphinscheduler_instance_api_request_count`, `aggregate_labels(meter_dolphinscheduler_instance_api_response_count, sum)`).

- **API Response Latency p99 (ms)** — response time percentile (`meter_dolphinscheduler_instance_api_response_time_percentile{p='99'}`).

**Alert component**

- **Alert Send / Pending** — alert sends per minute (left axis) and pending queue depth (right). Gated on send traffic (`aggregate_labels(meter_dolphinscheduler_instance_alert_send_count, sum)`), not only on `alert_pending`.

## Requirements

The DOLPHINSCHEDULER dashboard is a pure consumer of what OAP reports — it invents no data, and a widget with no backing data simply reads `no data`. To populate it, OAP needs:

- **Cluster (service-scope) DolphinScheduler meters** — the `meter_dolphinscheduler_*` family (running workflows, prepared tasks, worker active threads, task / workflow outcomes, dispatch, execution duration, command create / submit).

- **Component (instance-scope) DolphinScheduler meters** — the `meter_dolphinscheduler_instance_*` family (Master / Worker / API / Alert meters), reported by each process.

These meters are produced by OAP from DolphinScheduler Prometheus metrics scraped by an OpenTelemetry Collector — see [DolphinScheduler monitoring](https://skywalking.apache.org/docs/main/next/en/setup/backend/backend-dolphinscheduler-monitoring/) for how to wire the scrape → OTLP → OAP path. Each metric is queried at its own OAP scope; OAP does not roll a metric up across scopes, so an instance-scope component metric is empty until that component reports it. When a component does not emit a family — a Worker that reports no Master failover metrics, or an API that reports no Alert pending — those widgets are hidden rather than shown empty.
