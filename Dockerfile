FROM alpine:3

COPY --chown=root:root ./src/ /app/
COPY --chown=root:root ./docker/entrypoint.sh /
WORKDIR /app

RUN apk add --update --no-cache samba-common-tools=4.18.4-r0 \
                                python3=3.11.4-r0 \
                                curl=8.1.2-r0 \
                                poetry=1.4.2-r1 \
                                samba-common=4.18.4-r0 \
 && chown root:root /app \
 && mkdir /app/home \
 && adduser -S -D -H -h /app/home appuser \
 && chown appuser:root /app/home \
 && chmod 0700 /app/home \
 && chmod 0555 /app/app.py /entrypoint.sh \
 && mkdir /.cache && chown nobody:nobody /.cache

USER appuser
RUN poetry install

EXPOSE 8080
HEALTHCHECK --interval=1m --timeout=30s --start-period=5s --retries=3 CMD [ "curl", "http://127.0.0.1:8080" ]

ENTRYPOINT [ "/entrypoint.sh" ]
