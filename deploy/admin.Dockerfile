FROM nginx:1.27-alpine AS production

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web-antd/dist /usr/share/nginx/html

EXPOSE 8080
