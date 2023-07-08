FROM alpine:3

VOLUME [ "/app" ]
WORKDIR /app

COPY --chown=root:root ./app.py /app/
COPY --chown=root:root ./docker/entrypoint.sh ./docker/gen-token /bin/
COPY --chown=root:root static /app/static/

RUN apk add --update --no-cache samba-common-tools=4.18.4-r0 \
                                python3=3.11.4-r0 \
                                curl=8.1.2-r0 \
 && adduser -S -D -H appuser \
 && chmod 0555 /app/app.py /bin/entrypoint.sh /bin/gen-token \
 && mkdir /app/res \
 && chown appuser:root /app/res \
 && chmod 0700 /app/res

EXPOSE 8443 8080
USER appuser
HEALTHCHECK --interval=1m --timeout=30s --start-period=5s --retries=3 CMD [ "ash", "-c", "curl http://127.0.0.1:8080 || curl -k https://127.0.0.1:8443" ]

ENTRYPOINT [ "/bin/entrypoint.sh" ]
