from typing import Final

from fastapi import FastAPI
from fastapi.testclient import TestClient

from litellm.proxy.middleware.product_contract_middleware import ProductContractMiddleware
from litellm.proxy.public_endpoints.public_endpoints import router


def test_product_updates_and_legacy_route_return_empty_announcements():
    app: Final = FastAPI()
    app.include_router(router)
    app.add_middleware(ProductContractMiddleware)
    with TestClient(app) as client:
        for path in ("/public/gateway_updates", "/public/litellm_blog_posts"):
            response: Final = client.get(path)
            assert response.status_code == 200
            assert response.json() == {"posts": []}
