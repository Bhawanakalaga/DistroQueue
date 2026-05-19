# Distributed Job Queue: The Absolute Beginner's Guide

Welcome to the world of **Distributed Systems**! This guide is designed for beginners who want to understand how massive companies like **Amazon, Uber, and Netflix** handle millions of tasks without breaking their systems.

---

## SECTION 1 — BASIC CONCEPTS (Simple Explanation)

### What is this project?
Imagine a **Pizza Shop**. 
1. **The Cashier (REST API)** takes orders from customers.
2. The Cashier doesn't cook the pizza. They write the order on a **Slip (Job)** and put it on a **Hook (Queue)**.
3. Multiple **Chefs (Workers)** look at the hook. As soon as a chef is free, they grab the oldest slip and start cooking.
4. If a Chef drops a pizza **(Failure)**, they try again **(Retry)**.
5. If they fail 3 times, they put the slip in a **Special Bin (Dead-Letter Queue)** so the manager can check what's wrong.

### Key Terms
- **Redis (The Hook):** A super-fast temporary storage where we put our "slips" (jobs).
- **PostgreSQL (The Ledger):** A permanent book where we record every order that ever happened.
- **Worker Threads:** Like having 5 chefs in the kitchen instead of 1. They work **Concurrently** (at the same time).
- **Exponential Backoff:** If you fail, don't retry immediately. Wait 2 seconds, then 4, then 8. This gives the "oven" (service) time to cool down/fix itself.
- **Docker:** A "Kitchen-in-a-Box". It lets you run the exact same kitchen setup on any laptop.

---

## SECTION 2 — SOFTWARE INSTALLATION (Windows 11)

### 1. Java 21 (The Language)
- **Why:** This is the engine that runs our code.
- **Download:** [Adoptium Temurin 21](https://adoptium.net/temurin/releases/?version=21)
- **Step:** Download the `.msi` for Windows x64. Run it and check "Set JAVA_HOME" during installation.
- **Verify:** Open CMD and type `java -version`.

### 2. VS Code (The Editor)
- **Why:** Where we write our code.
- **Download:** [VS Code Official Site](https://code.visualstudio.com/)
- **Extensions:** Install "Extension Pack for Java" and "Spring Boot Extension Pack".

### 3. Docker Desktop (The Environment)
- **Why:** To run Redis and PostgreSQL without installing them manually.
- **Download:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Note:** You may need to enable WSL 2 in Windows features.

### 4. Postman (The Tester)
- **Why:** To send fake "orders" to our API.
- **Download:** [Postman](https://www.postman.com/downloads/)

---

## SECTION 3 — PROJECT STRUCTURE

```text
distributed-job-queue/
├── src/main/java/com/example/queue/
│   ├── controller/      <-- The Cashier (Receives API requests)
│   ├── service/         <-- The Logic (Manages the queue)
│   ├── worker/          <-- The Chefs (Worker threads)
│   ├── model/           <-- The Slip (Job data structure)
│   ├── repository/      <-- The Ledger (Database access)
│   └── config/          <-- The Kitchen Setup (Redis/DB config)
├── src/main/resources/
│   └── application.properties <-- Settings (DB passwords, etc.)
├── Dockerfile           <-- Recipe to "Box" the app
├── docker-compose.yml   <-- Recipe to "Box" Redis, DB, and App together
└── pom.xml              <-- The Shopping List (Dependencies/Libraries)
```

---

## SECTION 4 — SPRING BOOT SETUP (pom.xml)

You need these "ingredients" in your `pom.xml`:
- `spring-boot-starter-web`: To handle REST APIs.
- `spring-boot-starter-data-jpa`: To talk to PostgreSQL.
- `spring-boot-starter-data-redis`: To talk to Redis.
- `postgresql`: The database driver.
- `lombok`: To write less code (shorthand for getters/setters).

---

## SECTION 5 — THE CODE BLOCKS (The Java Logic)

### 1. The Job Model (model/Job.java)
This is our "Slip". It stores: `id`, `type` (Email/Payment), `status` (Pending/Completed), and `retryCount`.

### 2. The Worker (worker/WorkerThread.java)
```java
public void run() {
    while(true) {
        Job job = redisQueue.pop(); // Chef grabs a slip
        if (job != null) {
            try {
                process(job); // Cook the pizza
                db.markAsCompleted(job.id);
            } catch (Exception e) {
                handleFailure(job); // Try again or move to DLQ
            }
        }
    }
}
```

### 3. The Retry Logic (service/RetryService.java)
We calculate the wait time: `delay = Math.pow(2, retryCount)`.

---

## SECTION 6 — HOW TO RUN IT

1. **Start Infrastructure:** Open terminal and run `docker-compose up -d`. This starts Redis and Postgres.
2. **Build App:** Run `mvn clean install`.
3. **Run App:** Press F5 in VS Code or run `mvn spring-boot:run`.
4. **Test:** Open Postman and send a POST request to `http://localhost:8080/api/jobs`.

---

## SECTION 7 — INTERVIEW & RESUME TIPS

### What to say in an interview:
"I built a high-throughput system that uses **Redis** as a distributed queue to decouple job submission from execution. I implemented **Concurrency** using Java's `ExecutorService` and ensured reliability with **Exponential Backoff retries** and a **Dead-Letter Queue** for terminal failures."

### Key Skills on Resume:
- **Distributed Computing**
- **Multithreading & Concurrency**
- **Redis & PostgreSQL**
- **Docker & Microservices**
- **Spring Boot 3.x**
