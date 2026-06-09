/*
 * voicememo-runner — dedicated launcher for the Voice Memos -> Notes agent.
 *
 * Why this exists
 * ---------------
 * Reading Apple Voice Memos recordings requires Full Disk Access (TCC), because
 * they live in another app's group container under ~/Library. Rather than grant
 * Full Disk Access to the shared system /bin/bash (which would apply to every
 * launchd-run bash job), launchd runs THIS binary and you grant Full Disk
 * Access to THIS binary alone.
 *
 * How it stays surgical
 * ---------------------
 * It spawns /bin/bash as a CHILD (posix_spawn, not exec) and waits. Because a
 * launchd job is its own TCC "responsible process" and children inherit that
 * responsibility, every descendant (bash, find, python) is attributed back to
 * this launcher — so the single Full Disk Access grant on this binary covers
 * the whole pipeline, and the system bash is never granted anything.
 *
 * If it instead exec()'d bash, the running image would become /bin/bash and TCC
 * would check the system bash's grant — defeating the isolation. Hence: spawn.
 *
 * Build
 * -----
 *   cc -O2 -o voicememo-runner voicememo-runner.c
 *
 * Usage (from the launchd plist's ProgramArguments)
 * -------------------------------------------------
 *   [ <path to voicememo-runner>, /path/to/watch-and-process.sh ]
 */

#include <spawn.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s <script> [args...]\n", argv[0]);
        return 64; /* EX_USAGE */
    }

    /* Child command line: /bin/bash <script> [args...] */
    char **child = calloc((size_t)argc + 1, sizeof(char *));
    if (!child) {
        perror("calloc");
        return 71; /* EX_OSERR */
    }
    child[0] = "/bin/bash";
    for (int i = 1; i < argc; i++) {
        child[i] = argv[i];
    }
    child[argc] = NULL;

    pid_t pid;
    int rc = posix_spawn(&pid, "/bin/bash", NULL, NULL, child, environ);
    free(child);
    if (rc != 0) {
        fprintf(stderr, "posix_spawn(/bin/bash) failed: %d\n", rc);
        return 70; /* EX_SOFTWARE */
    }

    int status = 0;
    if (waitpid(pid, &status, 0) < 0) {
        perror("waitpid");
        return 71;
    }

    if (WIFEXITED(status)) {
        return WEXITSTATUS(status);
    }
    if (WIFSIGNALED(status)) {
        return 128 + WTERMSIG(status);
    }
    return 1;
}
