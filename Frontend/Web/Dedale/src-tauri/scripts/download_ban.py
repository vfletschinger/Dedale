#!/usr/bin/env python3
"""
Script pour télécharger la Base Adresse Nationale (BAN) et la convertir en SQLite.
La BAN contient toutes les adresses officielles françaises.

Usage:
    python download_ban.py [departement]

Exemples:
    python download_ban.py 67        # Bas-Rhin uniquement
    python download_ban.py 67 68     # Bas-Rhin et Haut-Rhin
    python download_ban.py           # Par défaut: 67 (Bas-Rhin)
"""

import csv
import gzip
import io
import os
import sqlite3
import sys
import urllib.request
from pathlib import Path


def download_ban_csv(departement: str) -> str:
    """Télécharge le fichier CSV de la BAN pour un département."""
    url = f"https://adresse.data.gouv.fr/data/ban/adresses/latest/csv/adresses-{departement}.csv.gz"
    print(f"📥 Téléchargement de {url}...")

    try:
        with urllib.request.urlopen(url) as response:
            compressed_data = response.read()
            print(
                f"   Téléchargé: {len(compressed_data) / 1024 / 1024:.1f} MB compressé"
            )

            # Décompresser
            decompressed_data = gzip.decompress(compressed_data)
            print(f"   Décompressé: {len(decompressed_data) / 1024 / 1024:.1f} MB")

            return decompressed_data.decode("utf-8")
    except Exception as e:
        print(f"❌ Erreur de téléchargement: {e}")
        sys.exit(1)


def create_database(db_path: Path):
    """Crée la base de données SQLite avec le schéma approprié."""
    print(f"🗄️  Création de la base de données: {db_path}")

    # Supprimer l'ancienne base si elle existe
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Table principale des adresses
    cursor.execute("""
        CREATE TABLE addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            numero TEXT,
            rue TEXT,
            code_postal TEXT,
            ville TEXT NOT NULL,
            display_name TEXT NOT NULL
        )
    """)

    # Index pour les recherches
    cursor.execute(
        "CREATE INDEX idx_display_name ON addresses(display_name COLLATE NOCASE)"
    )
    cursor.execute("CREATE INDEX idx_ville ON addresses(ville COLLATE NOCASE)")
    cursor.execute("CREATE INDEX idx_code_postal ON addresses(code_postal)")

    conn.commit()
    return conn


def import_csv_to_db(conn: sqlite3.Connection, csv_data: str, departement: str):
    """Importe les données CSV dans la base SQLite."""
    print(f"📝 Import des adresses du département {departement}...")

    cursor = conn.cursor()
    reader = csv.DictReader(io.StringIO(csv_data), delimiter=";")

    count = 0
    batch = []
    batch_size = 10000

    for row in reader:
        try:
            # Extraire les données
            lat = float(row.get("lat", 0))
            lon = float(row.get("lon", 0))
            numero = row.get("numero", "").strip()
            rue = row.get("nom_voie", "").strip()
            code_postal = row.get("code_postal", "").strip()
            ville = row.get("nom_commune", "").strip()

            # Ignorer les lignes sans coordonnées
            if lat == 0 or lon == 0:
                continue

            # Construire le display_name
            parts = []
            if numero:
                parts.append(numero)
            if rue:
                parts.append(rue)

            if parts:
                display_name = f"{' '.join(parts)}, {ville}"
            else:
                display_name = ville

            batch.append((lat, lon, numero, rue, code_postal, ville, display_name))
            count += 1

            # Insérer par lots pour la performance
            if len(batch) >= batch_size:
                cursor.executemany(
                    "INSERT INTO addresses (lat, lon, numero, rue, code_postal, ville, display_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    batch,
                )
                conn.commit()
                print(f"   {count:,} adresses importées...")
                batch = []

        except (ValueError, KeyError) as e:
            continue

    # Insérer le reste
    if batch:
        cursor.executemany(
            "INSERT INTO addresses (lat, lon, numero, rue, code_postal, ville, display_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
            batch,
        )
        conn.commit()

    print(f"✅ {count:,} adresses importées pour le département {departement}")
    return count


def add_cities_and_places(conn: sqlite3.Connection):
    """Ajoute les villes comme entrées recherchables (sans numéro de rue)."""
    print("🏘️  Ajout des villes comme points de recherche...")

    cursor = conn.cursor()

    # Récupérer les villes uniques avec leurs coordonnées moyennes
    cursor.execute("""
        INSERT INTO addresses (lat, lon, numero, rue, code_postal, ville, display_name)
        SELECT
            AVG(lat) as lat,
            AVG(lon) as lon,
            '' as numero,
            '' as rue,
            MIN(code_postal) as code_postal,
            ville,
            ville || ' (centre)' as display_name
        FROM addresses
        GROUP BY ville
    """)

    added = cursor.rowcount
    conn.commit()
    print(f"✅ {added} centres de villes ajoutés")


def optimize_database(conn: sqlite3.Connection):
    """Optimise la base de données."""
    print("⚡ Optimisation de la base de données...")

    cursor = conn.cursor()
    cursor.execute("ANALYZE")
    cursor.execute("VACUUM")
    conn.commit()

    print("✅ Base de données optimisée")


def print_stats(conn: sqlite3.Connection):
    """Affiche les statistiques de la base."""
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM addresses")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT ville) FROM addresses")
    villes = cursor.fetchone()[0]

    cursor.execute("""
        SELECT ville, COUNT(*) as cnt
        FROM addresses
        GROUP BY ville
        ORDER BY cnt DESC
        LIMIT 10
    """)
    top_villes = cursor.fetchall()

    print("\n📊 Statistiques de la base:")
    print(f"   Total adresses: {total:,}")
    print(f"   Nombre de villes: {villes:,}")
    print("\n   Top 10 villes:")
    for ville, cnt in top_villes:
        print(f"      - {ville}: {cnt:,} adresses")


def main():
    # Départements à télécharger (par défaut: Bas-Rhin)
    departements = sys.argv[1:] if len(sys.argv) > 1 else ["67"]

    print("=" * 60)
    print("🇫🇷 Téléchargement de la Base Adresse Nationale (BAN)")
    print(f"   Départements: {', '.join(departements)}")
    print("=" * 60)

    # Chemin de sortie
    script_dir = Path(__file__).parent
    output_path = script_dir.parent / "resources" / "addresses.db"

    # Créer la base
    conn = create_database(output_path)

    total_count = 0

    # Télécharger et importer chaque département
    for dept in departements:
        csv_data = download_ban_csv(dept)
        count = import_csv_to_db(conn, csv_data, dept)
        total_count += count

    # Ajouter les centres de villes
    add_cities_and_places(conn)

    # Optimiser
    optimize_database(conn)

    # Statistiques
    print_stats(conn)

    conn.close()

    file_size = output_path.stat().st_size / 1024 / 1024
    print(f"\n✅ Base de données créée: {output_path}")
    print(f"   Taille: {file_size:.1f} MB")
    print(f"   Total: {total_count:,} adresses")
    print("\n💡 Vous pouvez maintenant relancer l'application Tauri!")


if __name__ == "__main__":
    main()
