from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "CREATE INDEX crawled_source_url_idx ON CrawledData (source_id, url(191));",
                "CREATE INDEX restaurant_detail_url_idx ON Restaurants (detail_url(191));",
            ],
            reverse_sql=[
                "DROP INDEX crawled_source_url_idx ON CrawledData;",
                "DROP INDEX restaurant_detail_url_idx ON Restaurants;",
            ],
        )
    ]
